import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "로그인",
  description: "탑캐스팅 회원 로그인 페이지입니다.",
  robots: { index: false, follow: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
