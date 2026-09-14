"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { email: string; verified: boolean; verifiedAt: string | null; sentAt: string | null };

export default function EmailVerifySection({ email, verified, verifiedAt, sentAt }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const send = async () => {
    setMsg(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ ok: true, text: `${email} 으로 인증 메일을 발송했습니다. 24시간 이내 메일의 링크를 클릭해주세요.` });
      router.refresh(); // 페이지의 최근 변경/발송 일시 갱신
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
    finally { setLoading(false); }
  };

  if (verified) {
    return (
      <div className="text-sm">
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-700 text-xs">
          ✓ 이메일 인증 완료 ({verifiedAt && new Date(verifiedAt).toLocaleDateString("ko-KR")})
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm space-y-2">
      <p className="text-gray-600">
        <span className="font-mono">{email}</span> 로 인증 메일을 받지 못하셨나요?
      </p>
      {sentAt && (
        <p className="text-xs text-gray-500">최근 발송: {new Date(sentAt).toLocaleString("ko-KR")}</p>
      )}
      <button onClick={send} disabled={loading} className="btn-primary text-xs h-9">
        {loading ? "발송 중..." : "📧 인증 메일 재발송"}
      </button>
      {msg && (
        <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>{msg.text}</p>
      )}
    </div>
  );
}
