import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcDiscountRate, formatKRW } from "@/lib/utils";
import AddToCartSection from "./AddToCartSection";
import MobilePurchaseBar from "./MobilePurchaseBar";
import ProductReviewSection from "@/components/ProductReviewSection";
import ProductJsonLd from "@/components/ProductJsonLd";
import ViewItemTracker from "@/components/ViewItemTracker";
import ImageGallery from "@/components/ImageGallery";
import ProductInfoTabs from "@/components/ProductInfoTabs";
import ProductQnaSection from "@/components/ProductQnaSection";
import { descriptionToHtml, descriptionToText } from "@/lib/product-html";
import { getSiteSettings } from "@/lib/site-settings";
import { formatMin } from "@/lib/shipping";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const SITE_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const product = await prisma.product
    .findUnique({
      where: { id: params.id },
      select: { name: true, brand: true, description: true, thumbnail: true, salePrice: true, price: true, isActive: true, category: { select: { name: true } } },
    })
    .catch(() => null);

  if (!product || !product.isActive) {
    return { title: "상품을 찾을 수 없습니다", robots: { index: false } };
  }

  const finalPrice = product.salePrice ?? product.price;
  const desc = descriptionToText(product.description) || `${product.name} - ${product.category.name} | ${SITE_NAME}`.slice(0, 160);
  const titleLine = product.brand ? `${product.brand} ${product.name}` : product.name;
  const image = product.thumbnail
    ? (product.thumbnail.startsWith("http") ? product.thumbnail : `${SITE}${product.thumbnail}`)
    : `${SITE}/images/og-default.png`;

  return {
    title: titleLine,
    description: `${desc} - ${finalPrice.toLocaleString()}원`,
    openGraph: {
      type: "website",
      title: `${titleLine} | ${SITE_NAME}`,
      description: desc,
      images: [{ url: image, width: 1200, height: 630, alt: product.name }],
      url: `${SITE}/products/${params.id}`,
    },
    twitter: { card: "summary_large_image", title: titleLine, description: desc, images: [image] },
    alternates: { canonical: `${SITE}/products/${params.id}` },
  };
}

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const product = await prisma.product
    .findUnique({
      where: { id: params.id },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    })
    .catch(() => null);

  if (!product || !product.isActive) notFound();

  const finalPrice = product.salePrice ?? product.price;
  const discount = calcDiscountRate(product.price, product.salePrice);

  // 위시리스트 여부
  const inWishlist = userId
    ? !!(await prisma.wishlist.findUnique({ where: { userId_productId: { userId, productId: product.id } } }).catch(() => null))
    : false;

  // 평점 집계
  const ratingAgg = await prisma.review.aggregate({
    where: { productId: product.id, isHidden: false },
    _avg: { rating: true },
    _count: { rating: true },
  }).catch(() => ({ _avg: { rating: null }, _count: { rating: 0 } }));

  // 공개 Q&A 개수 (탭 표시용)
  const qnaCount = await prisma.productQuestion.count({ where: { productId: product.id, isHidden: false } }).catch(() => 0);

  const detailHtml = descriptionToHtml(product.description);
  const freeMin = (await getSiteSettings()).freeShippingMin;
  const pointRate = parseFloat(process.env.POINT_EARN_RATE || "0.01");
  const pointRatePct = Math.round(pointRate * 1000) / 10;
  const expectedPoints = Math.floor((finalPrice * pointRate) / 10) * 10;
  const totalStock = product.variants.length > 0
    ? product.variants.reduce((s, v) => s + v.stock, 0)
    : product.stock;

  return (
    <div className="container-mall py-6">
      {/* SEO 구조화 데이터 */}
      <ProductJsonLd
        id={product.id}
        name={product.name}
        description={descriptionToText(product.description, 500) || null}
        brand={product.brand}
        sku={product.sku}
        thumbnail={product.thumbnail}
        images={product.images}
        price={product.price}
        salePrice={product.salePrice}
        inStock={totalStock > 0}
        ratingValue={ratingAgg._avg.rating || undefined}
        reviewCount={ratingAgg._count.rating}
      />
      {/* GA4 view_item 이벤트 */}
      <ViewItemTracker
        id={product.id}
        name={product.name}
        brand={product.brand}
        category={product.category.name}
        price={finalPrice}
        thumbnail={product.thumbnail}
        listPrice={product.price}
        salePrice={product.salePrice}
      />

      <nav className="text-xs text-gray-500 mb-4">
        <Link href="/" className="hover:text-brand-600">홈</Link>
        <span className="mx-1">›</span>
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-brand-600">
          {product.category.name}
        </Link>
        <span className="mx-1">›</span>
        <span className="text-gray-700">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-8 lg:gap-12">
        {/* 좌: 이미지 */}
        <div className="lg:col-start-1 lg:row-start-1">
          <ImageGallery
            thumbnail={product.thumbnail}
            images={product.images}
            alt={product.name}
          />
        </div>

        {/* 우: 구매 패널 — 상세 내용을 스크롤하는 동안 화면에 고정 */}
        <aside className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-4 lg:self-start">
          <div className="lg:border lg:border-gray-200 lg:rounded-xl lg:p-6">
            {product.brand && <div className="text-sm text-gray-500">{product.brand}</div>}
            <h1 className="mt-1 text-[22px] font-bold leading-snug text-gray-900">{product.name}</h1>

            {/* 평점 */}
            <div className="mt-2 flex items-center gap-1.5 text-sm">
              <span className="text-amber-400">★</span>
              <span className="font-bold text-gray-900">{(ratingAgg._avg.rating || 0).toFixed(1)}</span>
              <span className="text-gray-300">|</span>
              <a href="#section-reviews" className="text-gray-500 hover:underline">{ratingAgg._count.rating}건 리뷰</a>
            </div>

            {/* 가격 */}
            <div className="mt-4">
              {discount > 0 && <div className="text-sm text-gray-400 line-through">{formatKRW(product.price)}</div>}
              <div className="flex items-baseline gap-2">
                {discount > 0 && <span className="text-red-500 font-bold text-xl">{discount}%</span>}
                <span className="text-[30px] font-extrabold text-red-500 leading-none">{formatKRW(finalPrice)}</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>
                배송비 3,000원 <span className="text-gray-400">({formatMin(freeMin)} 이상 무료배송)</span>
              </div>
            </div>

            {/* 적립 / 배송 / 상품번호 */}
            <dl className="mt-5 pt-5 border-t border-gray-200 space-y-3 text-sm">
              <div className="flex gap-4">
                <dt className="w-14 shrink-0 text-gray-500">적립</dt>
                <dd className="text-gray-800">
                  구매 시 <b className="text-brand-600">{formatKRW(expectedPoints)}</b> 적립 예정
                  <span className="text-gray-400 ml-1">(구매금액의 {pointRatePct}%)</span>
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-14 shrink-0 text-gray-500">배송</dt>
                <dd className="text-gray-800">
                  배송비 3,000원 <span className="text-gray-400">({formatMin(freeMin)} 이상 무료)</span>
                  <div className="text-gray-500 mt-0.5">평일 14시 이전 결제 시 당일 출고 · CJ대한통운</div>
                </dd>
              </div>
              <div className="flex gap-4">
                <dt className="w-14 shrink-0 text-gray-500">상품번호</dt>
                <dd className="text-gray-600">{product.sku}</dd>
              </div>
            </dl>

            {/* 모바일에서는 하단 구매 바의 옵션 시트를 쓰므로 여기서는 숨김 */}
            <div className="hidden lg:block mt-5 pt-1 border-t border-gray-200">
              <AddToCartSection
                product={{
                  id: product.id,
                  name: product.name,
                  price: finalPrice,
                  thumbnail: product.thumbnail,
                  stock: product.stock,
                }}
                variants={product.variants.map((v) => ({
                  id: v.id,
                  name: v.name,
                  colorHex: v.colorHex,
                  optionType: v.optionType,
                  stock: v.stock,
                  priceModifier: v.priceModifier,
                  thumbnail: v.thumbnail,
                }))}
                wishlist={{ initialActive: inWishlist, signedIn: !!userId }}
              />
            </div>
          </div>
        </aside>

        {/* 모바일: 하단 고정 구매 바 + 옵션 시트 (lg 미만) */}
        <MobilePurchaseBar
          product={{ id: product.id, name: product.name, price: finalPrice, thumbnail: product.thumbnail, stock: product.stock }}
          variants={product.variants.map((v) => ({ id: v.id, name: v.name, colorHex: v.colorHex, optionType: v.optionType, stock: v.stock, priceModifier: v.priceModifier, thumbnail: v.thumbnail }))}
          wishlist={{ initialActive: inWishlist, signedIn: !!userId }}
        />

        {/* 좌: 탭 + 상세 / Q&A / 배송·반품 / 리뷰 (구매 패널은 오른쪽에 고정된 채 이 영역을 스크롤) */}
        <div className="lg:col-start-1 lg:row-start-2 min-w-0">
          <ProductInfoTabs reviewCount={ratingAgg._count.rating} qnaCount={qnaCount} />

          <section id="section-detail" className="pt-8 scroll-mt-32">
            <h2 className="text-lg font-bold mb-4 text-gray-900">상품상세정보</h2>
            {detailHtml ? (
              <div className="product-detail max-w-[860px] mx-auto min-h-[120px] py-4" dangerouslySetInnerHTML={{ __html: detailHtml }} />
            ) : (
              <div className="text-sm text-gray-500 min-h-[120px] py-4">상세 설명이 등록되지 않았습니다.</div>
            )}
          </section>

          <section id="section-reviews" className="pt-12 scroll-mt-32">
            <ProductReviewSection productId={product.id} />
          </section>

          <section id="section-qna" className="pt-12 scroll-mt-32">
            <ProductQnaSection productId={product.id} />
          </section>

          <section id="section-shipping" className="pt-12 scroll-mt-32">
            <h2 className="text-lg font-bold mb-4 text-gray-900">배송 / 교환·반품 안내</h2>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="card p-5">
                <h3 className="font-bold mb-2 text-gray-800">🚚 배송 안내</h3>
                <ul className="space-y-1.5 text-gray-600">
                  <li>• 평일 14시 이전 결제 시 당일 출고</li>
                  <li>• 배송비 3,000원 ({formatMin(freeMin, "만")} 이상 무료)</li>
                  <li>• 도서/산간 지역 추가 배송비 발생 가능</li>
                  <li>• 평균 1~3일 소요 (CJ대한통운)</li>
                </ul>
              </div>
              <div className="card p-5">
                <h3 className="font-bold mb-2 text-gray-800">↩ 교환·반품</h3>
                <ul className="space-y-1.5 text-gray-600">
                  <li>• 상품 수령 후 7일 이내 신청</li>
                  <li>• 단순 변심 반품 배송비 5,000원 (왕복)</li>
                  <li>• 상품 불량/오배송은 무료 교환·반품</li>
                  <li>• 사용/훼손/포장 개봉 후 반품 불가</li>
                </ul>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-amber-400 tracking-tight">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n}>{value >= n ? "★" : value >= n - 0.5 ? "☆" : "☆"}</span>
      ))}
    </span>
  );
}
