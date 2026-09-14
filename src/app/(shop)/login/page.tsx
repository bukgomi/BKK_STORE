"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const sp = useSearchParams();
  // 같은 사이트 내부 경로만 허용 (외부 주소로의 리다이렉트 방지)
  const rawCallback = sp.get("callbackUrl") || "/";
  // "/" 로 시작하되 "//" 나 "/\" 처럼 프로토콜 상대 주소로 해석될 수 있는 값은 거부
  const callbackUrl = /^\/(?![\/\\])/.test(rawCallback) ? rawCallback : "/";
  const resetDone = sp.get("reset") === "ok";
  // NextAuth 가 소셜 로그인 실패 시 ?error= 로 돌려보냄
  const OAUTH_ERRORS: Record<string, string> = {
    OAuthAccountNotLinked: "같은 이메일로 이미 가입된 계정이 있습니다. 아이디/비밀번호로 로그인해 주세요.",
    AccountBlocked: "탈퇴 또는 이용 정지된 계정입니다. 고객센터로 문의해 주세요.",
    OAuthSignin: "소셜 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    OAuthCallback: "소셜 로그인 인증에 실패했습니다. 다시 시도해 주세요.",
    Callback: "소셜 로그인 처리 중 오류가 났습니다. 다시 시도해 주세요.",
    AccessDenied: "소셜 로그인이 취소되었습니다.",
  };
  const methodLabel: Record<string, string> = { credentials: "아이디/비밀번호", naver: "네이버", kakao: "카카오" };
  const dupMethods = (sp.get("methods") || "").split(",").filter(Boolean).map((m) => methodLabel[m] || m).join(", ");
  const dupHint = sp.get("hint") || "";
  const oauthError = sp.get("error") === "PhoneDuplicate"
    ? `이미 같은 휴대폰 번호로 가입된 계정이 있습니다.${dupMethods ? ` 기존 계정은 ${dupMethods} 로그인으로 가입되어 있어요.` : ""}${dupHint ? ` (아이디 ${dupHint})` : ""} 그 방법으로 로그인하거나 아이디/비밀번호 찾기를 이용해 주세요.`
    : (OAUTH_ERRORS[sp.get("error") || ""] || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState(false); // true 면 OTP 입력 단계
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(oauthError);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await signIn("credentials", {
      redirect: false,
      username: username.trim().toLowerCase(),
      password,
      otpCode,
    });
    setLoading(false);
    if (res?.error) {
      if (res.error === "OTP_REQUIRED") {
        setOtpStep(true);
        setError("");
      } else if (res.error === "OTP_INVALID") {
        setError("OTP 코드가 올바르지 않습니다. 인증 앱의 6자리 코드 또는 백업코드를 입력해주세요.");
      } else if (res.error.includes("로그인 시도") || res.error.includes("탈퇴") || res.error.includes("정지")) {
        setError(res.error);
      } else {
        setError("아이디(또는 이메일) 또는 비밀번호가 올바르지 않습니다.");
      }
    } else {
      // 헤더 등 서버 컴포넌트가 새 세션으로 다시 그려지도록 전체 이동 (client 라우터 캐시에 남은 로그아웃 상태 화면 방지)
      window.location.assign(callbackUrl);
    }
  };

  const resetOtp = () => {
    setOtpStep(false);
    setOtpCode("");
    setError("");
  };

  const social = (provider: "naver" | "kakao") => {
    signIn(provider, { callbackUrl });
  };

  return (
    <div className="container-mall py-16 max-w-[480px]">
      <h1 className="text-3xl font-bold text-center mb-2">로그인</h1>
      <p className="text-center text-sm text-gray-500 mb-10">
        탑캐스팅에 오신 것을 환영합니다
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-base font-semibold text-gray-800 mb-2">
            아이디 또는 이메일
          </label>
          <input
            type="text" required minLength={4} maxLength={320}
            className="w-full h-14 px-4 text-base border border-gray-300 rounded-md outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
            autoComplete="username"
            placeholder="아이디 또는 이메일 주소"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            disabled={otpStep}
          />
        </div>

        <div>
          <label className="block text-base font-semibold text-gray-800 mb-2">
            비밀번호
          </label>
          <input
            type="password" required
            className="w-full h-14 px-4 text-base border border-gray-300 rounded-md outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={otpStep}
          />
        </div>

        {otpStep && (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 space-y-3">
            <label className="block text-base font-semibold text-amber-900">
              🔐 2단계 인증 코드
            </label>
            <input
              type="text" inputMode="text" autoComplete="one-time-code"
              className="w-full h-14 px-4 text-lg font-mono tracking-widest border border-amber-300 rounded-md outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              placeholder="6자리 OTP 또는 XXXX-XXXX 백업코드"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              autoFocus required maxLength={32}
            />
            <p className="text-sm text-amber-800 leading-relaxed">
              인증 앱(Google Authenticator / Authy 등)의 6자리 코드를 입력해주세요.<br />
              인증 앱을 사용할 수 없는 경우 발급받은 백업코드(XXXX-XXXX)를 입력하면 됩니다. (1회용)
            </p>
            <button type="button" onClick={resetOtp} className="text-sm text-amber-800 hover:text-amber-900 underline font-medium">
              ← 다른 계정으로 로그인
            </button>
          </div>
        )}

        {resetDone && !error && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-md px-4 py-3">
            <p className="text-sm text-emerald-800">비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3">
            <p className="text-sm text-red-700 leading-relaxed">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-14 rounded-md bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-lg font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "로그인 중..." : (otpStep ? "OTP 확인 후 로그인" : "로그인")}
        </button>
      </form>

      <div className="my-8 flex items-center gap-3 text-sm text-gray-400">
        <div className="flex-1 h-px bg-gray-200" />
        <span>또는 SNS로 간편 로그인</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => social("naver")}
          className="w-full h-14 rounded-md text-white text-base font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "#03C75A" }}
        >
          <NaverIcon /> 네이버로 로그인
        </button>
        <button
          type="button"
          onClick={() => social("kakao")}
          className="w-full h-14 rounded-md text-base font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: "#FEE500", color: "#000000d9" }}
        >
          <KakaoIcon /> 카카오로 로그인
        </button>
      </div>

      <div className="mt-8 text-center space-y-3">
        <div className="text-base text-gray-600">
          아직 회원이 아니신가요?{" "}
          <Link href="/register" className="text-brand-600 hover:text-brand-700 hover:underline font-bold">
            회원가입
          </Link>
        </div>
        <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
          <Link href="/forgot-id" className="hover:text-brand-600 hover:underline">아이디 찾기</Link>
          <span className="text-gray-300">|</span>
          <Link href="/forgot-password" className="hover:text-brand-600 hover:underline">비밀번호 찾기</Link>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-400 text-center leading-relaxed">
        SSL/TLS 암호화 통신 · 비밀번호는 본 사이트에 평문으로 저장되지 않습니다.<br />
        소셜 로그인시 해당 서비스의 약관과 개인정보 처리방침이 적용됩니다.
      </p>
    </div>
  );
}

function NaverIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727z" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.829 1.872 5.297 4.694 6.687l-1.18 4.314c-.103.378.32.69.658.485l5.18-3.422c.213.022.432.036.648.036 5.523 0 10-3.477 10-7.8S17.523 3 12 3z" />
    </svg>
  );
}
