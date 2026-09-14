"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { enabled: boolean; enabledAt: string | null };

export default function TotpSection({ enabled, enabledAt }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "setup" | "confirm" | "backup">("idle");
  const [secret, setSecret] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const startSetup = async () => {
    setErr(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/totp/setup");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSecret(data.secret);
      setQrUrl(data.qrDataUrl);
      setStep("setup");
    } catch (e: any) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  const enable = async () => {
    setErr(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBackupCodes(data.backupCodes);
      setStep("backup");
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const disable = async () => {
    if (!confirm("2단계 인증을 비활성화하시겠습니까? 보안 수준이 낮아집니다.")) return;
    setErr(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/totp/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("2단계 인증이 비활성화되었습니다.");
      router.refresh();
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  if (enabled && step === "idle") {
    return (
      <div className="text-sm space-y-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-700 text-xs">
          ✓ 2단계 인증이 활성화되어 있습니다. ({enabledAt && new Date(enabledAt).toLocaleDateString("ko-KR")} 활성화)
        </div>
        <details>
          <summary className="cursor-pointer text-xs text-gray-500 hover:text-red-500">2단계 인증 비활성화</summary>
          <div className="mt-3 space-y-2">
            <input
              type="password" placeholder="현재 비밀번호" className="input h-10"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <button onClick={disable} disabled={loading || !password} className="btn-outline text-xs h-9 text-red-600 border-red-300">
              비활성화
            </button>
          </div>
        </details>
      </div>
    );
  }

  if (step === "idle") {
    return (
      <div className="text-sm space-y-3">
        <p className="text-gray-600">
          OTP 앱(Google Authenticator, Authy, 1Password 등)을 사용해 로그인 시 추가 인증을 요구합니다.
          계정이 탈취되어도 두 번째 보호막이 됩니다.
        </p>
        <button onClick={startSetup} disabled={loading} className="btn-primary h-10 text-sm">
          {loading ? "준비 중..." : "🔐 2단계 인증 시작"}
        </button>
      </div>
    );
  }

  if (step === "setup") {
    return (
      <div className="text-sm space-y-3">
        <p>1. OTP 앱에서 "+" 버튼 → "QR 코드 스캔" 선택</p>
        <p>2. 아래 QR 코드를 스캔하거나, 직접 입력</p>
        <div className="flex gap-4 items-start flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR" className="w-48 h-48 border border-gray-200 rounded" />
          <div className="text-xs space-y-1">
            <div className="text-gray-500">수동 입력 키:</div>
            <code className="font-mono bg-gray-100 px-2 py-1 rounded block break-all max-w-xs">{secret}</code>
          </div>
        </div>
        <p className="text-gray-600">3. OTP 앱에 표시된 6자리 코드 입력</p>
        <div className="flex gap-2">
          <input
            type="text" inputMode="numeric" maxLength={6} placeholder="6자리 코드"
            className="input h-10 w-32 font-mono text-center tracking-widest"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button onClick={enable} disabled={loading || code.length !== 6} className="btn-primary h-10 text-sm">
            {loading ? "확인 중..." : "활성화"}
          </button>
          <button onClick={() => setStep("idle")} className="btn-outline h-10 text-sm">취소</button>
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}
      </div>
    );
  }

  // backup codes 표시
  return (
    <div className="text-sm space-y-3">
      <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-700 text-xs">
        ✓ 2단계 인증이 활성화되었습니다.
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded p-4">
        <h3 className="font-bold text-sm text-amber-900 mb-2">⚠ 백업 코드 (1회용, 10개)</h3>
        <p className="text-xs text-amber-800 mb-3">
          OTP 앱을 잃어버렸을 때 사용할 수 있습니다. <b>안전한 곳에 저장하세요.</b>
          <br />이 화면을 닫으면 다시 볼 수 없습니다.
        </p>
        <div className="grid grid-cols-2 gap-1 font-mono text-xs">
          {backupCodes.map((c) => (
            <code key={c} className="bg-white px-2 py-1 rounded border border-amber-200">{c}</code>
          ))}
        </div>
      </div>
      <button onClick={() => { setStep("idle"); router.refresh(); }} className="btn-primary h-10 text-sm">완료</button>
    </div>
  );
}
