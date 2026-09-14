"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/store/toast";
import { validateUsernameFormat, normalizeUsername } from "@/lib/username";

function checkPasswordClient(pw: string): { score: number; label: string; color: string; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (pw.length >= 12) score++; else reasons.push("12자 이상");
  if (/[a-z]/.test(pw)) score++; else reasons.push("소문자");
  if (/[A-Z]/.test(pw)) score++; else reasons.push("대문자");
  if (/[0-9]/.test(pw)) score++; else reasons.push("숫자");
  if (/[^A-Za-z0-9]/.test(pw)) score++; else reasons.push("특수문자");

  if (score <= 2) return { score, label: "약함", color: "bg-red-500", reasons };
  if (score <= 3) return { score, label: "보통", color: "bg-amber-500", reasons };
  if (score <= 4) return { score, label: "강함", color: "bg-emerald-500", reasons };
  return { score, label: "매우 강함", color: "bg-emerald-600", reasons };
}

type UnameState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; checked: string }   // 사용가능 (어떤 값에 대해 확인했는지 저장)
  | { status: "taken"; reason: string }
  | { status: "invalid"; reason: string };

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", passwordConfirm: "", name: "", phone: "" });
  const [uname, setUname] = useState<UnameState>({ status: "idle" });
  const [agreeTos, setAgreeTos] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pwInfo = useMemo(() => checkPasswordClient(form.password), [form.password]);

  const usernameOk =
    uname.status === "available" && normalizeUsername(form.username) === uname.checked;

  const canSubmit =
    pwInfo.score >= 4 &&
    form.password === form.passwordConfirm &&
    usernameOk &&
    agreeTos &&
    agreePrivacy;

  // 디바운스 자동 중복확인 (입력 변할 때마다 형식만 즉시 검증, 0.6초 정지시 서버 조회)
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    const v = form.username;
    if (!v) { setUname({ status: "idle" }); return; }

    const fmt = validateUsernameFormat(v);
    if (!fmt.ok) { setUname({ status: "invalid", reason: fmt.reason || "" }); return; }

    setUname({ status: "checking" });
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const u = normalizeUsername(v);
        const res = await fetch(`/api/auth/check-username?u=${encodeURIComponent(u)}`);
        const data = await res.json();
        if (data.available) setUname({ status: "available", checked: u });
        else setUname({ status: "taken", reason: data.reason || "사용할 수 없는 아이디입니다." });
      } catch {
        setUname({ status: "invalid", reason: "확인 중 오류가 발생했습니다." });
      }
    }, 600);

    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [form.username]);

  const manualCheck = async () => {
    const fmt = validateUsernameFormat(form.username);
    if (!fmt.ok) { setUname({ status: "invalid", reason: fmt.reason || "" }); return; }
    setUname({ status: "checking" });
    try {
      const u = normalizeUsername(form.username);
      const res = await fetch(`/api/auth/check-username?u=${encodeURIComponent(u)}`);
      const data = await res.json();
      if (data.available) setUname({ status: "available", checked: u });
      else setUname({ status: "taken", reason: data.reason || "사용할 수 없는 아이디입니다." });
    } catch {
      setUname({ status: "invalid", reason: "확인 중 오류가 발생했습니다." });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!usernameOk) { setError("아이디 중복확인을 완료해주세요."); return; }
    if (form.password !== form.passwordConfirm) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (pwInfo.score < 4) { setError("비밀번호 정책을 만족하지 못합니다."); return; }

    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: normalizeUsername(form.username),
        email: form.email,
        password: form.password,
        name: form.name,
        phone: form.phone,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "가입 실패"); return; }
    toast.success("가입 완료! 적립금 1,000원이 지급되었어요 🎁");
    router.push("/login");
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // 아이디 입력 메시지
  const unameMsg = (() => {
    switch (uname.status) {
      case "checking": return { color: "text-gray-500", text: "확인 중..." };
      case "available": return { color: "text-emerald-600", text: "✓ 사용 가능한 아이디입니다." };
      case "taken": return { color: "text-red-500", text: uname.reason };
      case "invalid": return { color: "text-red-500", text: uname.reason };
      default: return { color: "text-gray-400", text: "4~20자 영문 소문자로 시작, 영소문자/숫자/언더스코어" };
    }
  })();

  return (
    <div className="container-mall py-16 max-w-md">
      <h1 className="text-2xl font-bold text-center mb-2">회원가입</h1>
      <p className="text-center text-xs text-gray-500 mb-6">가입시 적립금 1,000원이 즉시 지급됩니다 🎁</p>

      {/* 카카오 간편가입 — 별도 입력 없이 카카오 계정으로 바로 가입·로그인 */}
      <button
        type="button"
        onClick={() => signIn("kakao", { callbackUrl: "/?welcome=1" })}
        className="w-full h-14 rounded-md text-base font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: "#FEE500", color: "#000000d9" }}
      >
        <KakaoIcon /> 카카오로 3초 만에 가입하기
      </button>
      <p className="mt-2 text-center text-[11px] text-gray-400">카카오 계정으로 가입하면 아이디·비밀번호 없이 바로 이용할 수 있어요</p>

      <div className="my-6 flex items-center gap-3 text-sm text-gray-400">
        <div className="flex-1 h-px bg-gray-200" />
        <span>또는 직접 입력해서 가입</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">아이디 *</label>
          <div className="flex gap-2">
            <input
              type="text" required minLength={4} maxLength={20}
              className="input h-11 flex-1"
              placeholder="영문 소문자 / 숫자 / 언더스코어"
              autoComplete="username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
            />
            <button
              type="button"
              onClick={manualCheck}
              disabled={uname.status === "checking" || !form.username}
              className="h-11 px-3 text-xs rounded border border-gray-300 hover:bg-gray-50 whitespace-nowrap disabled:opacity-50"
            >
              중복확인
            </button>
          </div>
          <p className={`text-[11px] mt-1 ${unameMsg.color}`}>{unameMsg.text}</p>
        </div>

        <div>
          <label className="label">이메일 *</label>
          <input type="email" required className="input h-11" autoComplete="email" value={form.email} onChange={set("email")} />
          <p className="text-[11px] text-gray-400 mt-1">주문 내역, 비밀번호 찾기 등에 사용됩니다.</p>
        </div>

        <div>
          <label className="label">비밀번호 *</label>
          <input
            type="password" required minLength={12} className="input h-11" autoComplete="new-password"
            value={form.password} onChange={set("password")}
          />
          {form.password && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded bg-gray-100 overflow-hidden">
                  <div className={`h-full transition-all ${pwInfo.color}`} style={{ width: `${(pwInfo.score / 5) * 100}%` }} />
                </div>
                <span className="text-xs text-gray-600">{pwInfo.label}</span>
              </div>
              {pwInfo.reasons.length > 0 && (
                <p className="text-[11px] text-red-500 mt-1">필요: {pwInfo.reasons.join(", ")}</p>
              )}
              <p className="text-[11px] text-gray-400 mt-0.5">12자 이상 · 대/소문자, 숫자, 특수문자 중 3종 이상 조합</p>
            </div>
          )}
        </div>

        <div>
          <label className="label">비밀번호 확인 *</label>
          <input
            type="password" required className="input h-11" autoComplete="new-password"
            value={form.passwordConfirm} onChange={set("passwordConfirm")}
          />
          {form.passwordConfirm && form.password !== form.passwordConfirm && (
            <p className="text-[11px] text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>
          )}
        </div>

        <div>
          <label className="label">이름 *</label>
          <input type="text" required className="input h-11" autoComplete="name" value={form.name} onChange={set("name")} />
        </div>

        <div>
          <label className="label">연락처</label>
          <input type="tel" placeholder="010-0000-0000" className="input h-11" autoComplete="tel" value={form.phone} onChange={set("phone")} />
        </div>

        <div className="space-y-2 pt-2 text-xs">
          <label className="flex items-start gap-2 text-gray-600">
            <input type="checkbox" checked={agreeTos} onChange={(e) => setAgreeTos(e.target.checked)} className="mt-0.5" />
            <span><b>(필수)</b> 이용약관에 동의합니다.</span>
          </label>
          <label className="flex items-start gap-2 text-gray-600">
            <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} className="mt-0.5" />
            <span><b>(필수)</b> 개인정보 수집 및 이용에 동의합니다. (아이디/이메일/이름/연락처/배송지)</span>
          </label>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={loading || !canSubmit} className="btn-primary w-full h-12 text-base mt-2">
          {loading ? "처리 중..." : "가입하기"}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-brand-600 hover:underline">로그인</Link>
      </div>
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#000000d9" aria-hidden="true">
      <path d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.31 4.66 6.73l-1.19 4.37a.3.3 0 0 0 .46.33l5.09-3.38c.32.03.65.05.98.05 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
    </svg>
  );
}
