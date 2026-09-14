import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "회원가입",
  description: "탑캐스팅 회원가입 — 신규 가입 시 적립금 즉시 지급.",
  robots: { index: false, follow: false },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
