"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function check(pw: string) {
  let score = 0;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const colors = ["bg-red-500", "bg-red-500", "bg-amber-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-600"];
  const labels = ["약함", "약함", "보통", "보통", "강함", "매우 강함"];
  return { score, color: colors[score], label: labels[score] };
}

export default function ChangePasswordForm() {
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const info = useMemo(() => check(next), [next]);
  const canSubmit = cur && info.score >= 4 && next === confirm && cur !== next;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "변경 실패");
      setMsg({ ok: true, text: "비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해주세요." });
      setCur(""); setNext(""); setConfirm("");
      router.refresh(); // 페이지의 최근 변경/발송 일시 갱신
    } catch (e: any) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 max-w-md">
      <div>
        <label className="label">현재 비밀번호</label>
        <input type="password" required className="input h-10" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
      </div>
      <div>
        <label className="label">새 비밀번호</label>
        <input type="password" required minLength={12} className="input h-10" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        {next && (
          <div className="mt-1.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded bg-gray-100 overflow-hidden">
                <div className={`h-full transition-all ${info.color}`} style={{ width: `${(info.score / 5) * 100}%` }} />
              </div>
              <span className="text-xs text-gray-600">{info.label}</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">12자 이상 · 대/소문자, 숫자, 특수문자 중 3종 이상</p>
          </div>
        )}
      </div>
      <div>
        <label className="label">새 비밀번호 확인</label>
        <input type="password" required className="input h-10" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {confirm && next !== confirm && <p className="text-[11px] text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>}
      </div>

      {msg && (
        <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-red-500"}`}>{msg.text}</p>
      )}

      <button type="submit" disabled={loading || !canSubmit} className="btn-primary h-10 px-6 text-sm">
        {loading ? "변경 중..." : "비밀번호 변경"}
      </button>
    </form>
  );
}
