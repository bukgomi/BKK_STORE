"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWishlist } from "@/store/wishlist";

export default function WishlistItemActions({ productId }: { productId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const remove = async () => {
    if (!confirm("위시리스트에서 제거하시겠습니까?")) return;
    setLoading(true);
    try {
      const r = await useWishlist.getState().remove(productId); // 스토어가 API 호출 + 헤더 배지/하트 동기화
      if (r.ok) router.refresh();
      else alert(r.error || "제거 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={remove}
      disabled={loading}
      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 border border-gray-200 hover:border-red-300 hover:text-red-500 text-gray-400 text-sm shadow-sm"
      title="위시리스트에서 제거"
    >×</button>
  );
}
