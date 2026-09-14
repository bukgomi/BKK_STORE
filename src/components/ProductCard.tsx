import Link from "next/link";
import { calcDiscountRate, formatKRW } from "@/lib/utils";
import WishlistHeartButton from "./WishlistHeartButton";

type Props = {
  id: string;
  name: string;
  brand?: string | null;
  price: number;
  salePrice?: number | null;
  thumbnail?: string | null;
  /** 신상품 노출 (createdAt 기준 N일 이내) */
  createdAt?: Date | string;
  /** 베스트 노출 */
  isFeatured?: boolean;
  /** 옵션 합산 또는 단독 재고 */
  stock?: number;
  /** 카드 하단에 평점 라인을 보여줄지 */
  rating?: number;
  reviewCount?: number;
  /** 순위 뱃지 (1~N) */
  rank?: number;
};

const NEW_DAYS = 14;

export default function ProductCard({
  id, name, brand, price, salePrice, thumbnail,
  createdAt, isFeatured, stock, rating, reviewCount, rank,
}: Props) {
  const finalPrice = salePrice ?? price;
  const discount = calcDiscountRate(price, salePrice ?? null);
  const isNew = createdAt
    ? Date.now() - new Date(createdAt).getTime() < NEW_DAYS * 86400000
    : false;
  const soldOut = typeof stock === "number" && stock <= 0;

  return (
    <Link href={`/products/${id}`} className="group block">
      <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbnail || "/images/placeholder.svg"}
          alt={name}
          loading="lazy"
          className={`w-full h-full object-cover transition-transform duration-300 ${
            soldOut ? "opacity-50" : "group-hover:scale-105"
          }`}
        />

        {/* 뱃지 영역 */}
        {/* 순위 배지(좌상단 36px)가 있으면 그 아래로 내려서 겹치지 않게 */}
        <div className={`absolute left-2 flex flex-col items-start gap-1 ${rank !== undefined && rank > 0 ? "top-11" : "top-2"}`}>
          {discount > 0 && <span className="badge-sale">{discount}%</span>}
          {isFeatured && <span className="badge-best">BEST</span>}
          {isNew && <span className="badge-new">NEW</span>}
        </div>

        {/* 위시리스트 하트 (우상단) */}
        <WishlistHeartButton productId={id} variant="absolute" size={32} />

        {/* 순위 뱃지 */}
        {rank !== undefined && rank > 0 && (
          <div className="absolute top-0 left-0 w-9 h-9 bg-black/70 text-white text-base font-extrabold flex items-center justify-center rounded-br-lg">
            {rank}
          </div>
        )}

        {/* 품절 오버레이 */}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-gray-900/80 text-white text-sm font-bold px-4 py-1.5 rounded">SOLD OUT</span>
          </div>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        {brand && <div className="text-xs text-gray-500 truncate">{brand}</div>}
        <div className="text-[15px] text-gray-800 line-clamp-2 leading-snug group-hover:text-brand-600 transition-colors">
          {name}
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          {discount > 0 && <span className="text-accent-500 font-bold text-base">{discount}%</span>}
          <span className="text-xl font-extrabold text-gray-900">{formatKRW(finalPrice)}</span>
        </div>
        {discount > 0 && (
          <div className="text-xs text-gray-400 line-through">{formatKRW(price)}</div>
        )}
        {typeof rating === "number" && reviewCount !== undefined && reviewCount > 0 && (
          <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
            <span className="text-amber-400">★</span>
            <span className="font-medium text-gray-700">{rating.toFixed(1)}</span>
            <span className="text-gray-400">({reviewCount.toLocaleString()})</span>
          </div>
        )}
      </div>
    </Link>
  );
}
