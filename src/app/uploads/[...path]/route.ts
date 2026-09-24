// 업로드 파일 서빙 (STORAGE_PROVIDER=local)
//
// Next.js 는 운영 모드(next start)에서 "빌드 시점에 public/ 에 있던 파일"만 정적으로 내준다.
// 운영 중 관리자가 올린 이미지는 public/uploads 에 새로 생기므로 이 라우트가 디스크에서 직접 읽어 준다.
// (개발 모드나 빌드 시점에 이미 있던 파일은 Next 정적 서빙이 먼저 잡고, 없는 것만 여기로 온다)
// S3/R2 를 쓰면 URL 자체가 외부 주소라 이 라우트는 호출되지 않는다.
import { NextRequest, NextResponse } from "next/server";
import { stat, readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROOT = path.resolve(process.cwd(), "public", "uploads");
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".gif": "image/gif", ".avif": "image/avif", ".heic": "image/heic", ".heif": "image/heif",
  ".json": "application/json",
};

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const segments = params.path || [];
  // 경로 조작 방어: 세그먼트에 ..  / 빈 값 / 널바이트 금지, 최종 경로가 uploads 디렉터리 안에 있어야 함
  if (segments.length === 0 || segments.some((s) => !s || s === "." || s === ".." || s.includes("\0") || s.includes("/") || s.includes("\\"))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const file = path.resolve(ROOT, ...segments);
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return new NextResponse("Not found", { status: 404 });

  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return new NextResponse("Not found", { status: 404 }); // 이미지 등 허용된 확장자만

  try {
    const st = await stat(file);
    if (!st.isFile()) return new NextResponse("Not found", { status: 404 });
    const body = await readFile(file);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(st.size),
        // 업로드 파일명은 타임스탬프+랜덤이라 바뀌지 않음 → 장기 캐시
        "Cache-Control": "public, max-age=31536000, immutable",
        "Last-Modified": st.mtime.toUTCString(),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
