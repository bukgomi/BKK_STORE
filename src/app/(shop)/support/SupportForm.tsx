"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CATEGORIES = [
  { value: "ORDER", label: "주문 관련" },
  { value: "PAYMENT", label: "결제" },
  { value: "DELIVERY", label: "배송" },
  { value: "PRODUCT", label: "상품 문의" },
  { value: "REFUND", label: "환불/반품" },
  { value: "ACCOUNT", label: "계정" },
  { value: "ETC", label: "기타" },
];

export default function SupportForm() {
  const router = useRouter();
  const [category, setCategory] = useState("ETC");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "등록 실패");
      alert(`문의가 접수되었습니다. (${data.ticketNo})`);
      router.push(`/support/${data.id}`);
      router.refresh(); // 목록(라우터 캐시)에 새 문의가 바로 보이도록
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">분류</label>
        <select className="input h-10 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">제목 *</label>
        <input
          className="input h-10 text-sm" maxLength={200} required
          value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="간단히 요약"
        />
      </div>
      <div>
        <label className="label">내용 *</label>
        <textarea
          rows={6} className="input text-sm" maxLength={5000} required
          value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="자세한 내용을 입력해주세요. (5자 이상)"
        />
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full h-10 text-sm">
        {loading ? "등록 중..." : "문의하기"}
      </button>
      <p className="text-[11px] text-gray-400 text-center">
        평일 09:00~18:00 내 답변 (24시간 이내)
      </p>
    </form>
  );
}
