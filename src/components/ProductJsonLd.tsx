/**
 * 상품 상세 JSON-LD (schema.org Product)
 * - 검색 결과에 별점/가격/재고 등 리치 결과로 표시
 * - 네이버 / 구글 / 다음 모두 인식
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
const SITE_NAME = process.env.NEXT_PUBLIC_BUSINESS_NAME || "탑캐스팅";

type Props = {
  id: string;
  name: string;
  description?: string | null;
  brand?: string | null;
  sku: string;
  thumbnail?: string | null;
  images?: string[];
  price: number;
  salePrice?: number | null;
  inStock: boolean;
  ratingValue?: number;
  reviewCount?: number;
};

export default function ProductJsonLd({
  id, name, description, brand, sku, thumbnail, images,
  price, salePrice, inStock, ratingValue, reviewCount,
}: Props) {
  const finalPrice = salePrice ?? price;
  const allImages = [thumbnail, ...(images || [])]
    .filter(Boolean)
    .map((src) => (src!.startsWith("http") ? src : `${SITE}${src}`));

  const data: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE}/products/${id}`,
    name,
    description: description || name,
    sku,
    image: allImages.length > 0 ? allImages : undefined,
    url: `${SITE}/products/${id}`,
    offers: {
      "@type": "Offer",
      url: `${SITE}/products/${id}`,
      priceCurrency: "KRW",
      price: finalPrice,
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };

  if (brand) {
    data.brand = { "@type": "Brand", name: brand };
  }

  if (ratingValue && reviewCount && reviewCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue,
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // </script> 토큰을 escape 하여 script-injection 차단
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
