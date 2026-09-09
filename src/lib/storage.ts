/**
 * 파일 스토리지 추상화
 * - 기본: 로컬 파일시스템 (/public/uploads) — 개발용
 * - STORAGE_PROVIDER=s3 일때: S3 / Cloudflare R2 / MinIO 호환 (운영용)
 *
 * Vercel 등 서버리스 환경은 로컬 디스크 쓰기 불가 → 운영시 반드시 s3 사용.
 * 로컬 Docker 로 상품을 미리 등록해 두고 나중에 운영으로 옮길 계획이라면,
 * 로컬에서도 처음부터 s3(R2) 를 쓰는 편이 이전 작업이 없어 편하다.
 */

import { writeFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export type UploadInput = {
  buffer: Buffer;
  filename: string;
  contentType: string;
  /** 하위 디렉토리/프리픽스 (예: "reviews", "products") */
  prefix?: string;
};

export type UploadResult = {
  url: string;            // 클라이언트가 접근할 수 있는 공개 URL
  key: string;            // 스토리지 내부 식별자 (삭제용)
  provider: string;
};

export interface StorageProvider {
  readonly name: string;
  upload(input: UploadInput): Promise<UploadResult>;
  delete?(key: string): Promise<void>;
}

function safeName(filename: string): string {
  return filename.replace(/[^a-z0-9-_.]/gi, "_");
}

function safePrefix(prefix?: string): string {
  return (prefix || "").replace(/[^a-z0-9-_/]/gi, "").replace(/^\/+|\/+$/g, "");
}

/* ========== 로컬 FS ========== */

class LocalStorage implements StorageProvider {
  readonly name = "local";

  async upload({ buffer, filename, prefix }: UploadInput): Promise<UploadResult> {
    const sub = safePrefix(prefix);
    const dir = path.join(process.cwd(), "public", "uploads", sub);
    await mkdir(dir, { recursive: true });
    const name = safeName(filename);
    await writeFile(path.join(dir, name), buffer);
    const url = `/uploads${sub ? "/" + sub : ""}/${name}`;
    return { url, key: url, provider: "local" };
  }

  async delete(key: string): Promise<void> {
    if (!key.startsWith("/uploads/")) return;
    await unlink(path.join(process.cwd(), "public", key)).catch(() => {});
  }
}

/* ========== S3 호환 (AWS S3 / Cloudflare R2 / MinIO) ========== */

type S3Env = {
  bucket: string;
  publicBaseUrl: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export function readS3Env(): { ok: true; env: S3Env } | { ok: false; missing: string[] } {
  const bucket = process.env.S3_BUCKET;
  const publicBaseUrl = process.env.S3_PUBLIC_URL;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const missing = [
    !bucket && "S3_BUCKET", !publicBaseUrl && "S3_PUBLIC_URL", !accessKeyId && "S3_ACCESS_KEY", !secretAccessKey && "S3_SECRET_KEY",
  ].filter(Boolean) as string[];
  if (missing.length) return { ok: false, missing };
  return {
    ok: true,
    env: {
      bucket: bucket!,
      publicBaseUrl: publicBaseUrl!.replace(/\/$/, ""),
      region: process.env.S3_REGION || "auto",          // R2 는 "auto"
      endpoint: process.env.S3_ENDPOINT || undefined,     // R2: https://<account>.r2.cloudflarestorage.com
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
      forcePathStyle: /^(1|true|yes)$/i.test(process.env.S3_FORCE_PATH_STYLE || ""),
    },
  };
}

class S3Storage implements StorageProvider {
  readonly name = "s3";
  private client: S3Client;
  private env: S3Env;

  constructor(env: S3Env) {
    this.env = env;
    this.client = new S3Client({
      region: env.region,
      endpoint: env.endpoint,
      forcePathStyle: env.forcePathStyle,
      credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey },
    });
  }

  async upload({ buffer, filename, contentType, prefix }: UploadInput): Promise<UploadResult> {
    const key = [safePrefix(prefix), safeName(filename)].filter(Boolean).join("/");
    await this.client.send(new PutObjectCommand({
      Bucket: this.env.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }));
    return { url: `${this.env.publicBaseUrl}/${key}`, key, provider: "s3" };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.env.bucket, Key: key }));
  }
}

let _storage: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (_storage) return _storage;
  const provider = process.env.STORAGE_PROVIDER?.toLowerCase();
  if (provider === "s3") {
    const r = readS3Env();
    if (r.ok) {
      _storage = new S3Storage(r.env);
      return _storage;
    }
    const msg = `[storage] STORAGE_PROVIDER=s3 인데 환경변수 누락: ${r.missing.join(", ")}`;
    // 운영에서 로컬 디스크로 조용히 폴백되면 업로드가 배포마다 사라지므로 명시적으로 실패
    if (process.env.NODE_ENV === "production") throw new Error(msg);
    console.warn(`${msg} — 로컬 디스크로 폴백합니다.`);
  }
  _storage = new LocalStorage();
  return _storage;
}
