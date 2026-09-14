"use client";
import { useEffect } from "react";
import { trackViewItem } from "@/lib/analytics";
import { addRecentProduct } from "@/lib/recent-products";

type Props = {
  id: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  price: number;
  /** 최근 본 상품 패널용 */
  thumbnail?: string | null;
  listPrice?: number;
  salePrice?: number | null;
};

export default function ViewItemTracker(props: Props) {
  useEffect(() => {
    addRecentProduct({ id: props.id, name: props.name, thumbnail: props.thumbnail ?? null, price: props.listPrice ?? props.price, salePrice: props.salePrice ?? null });
    trackViewItem({
      value: props.price,
      items: [{
        item_id: props.id,
        item_name: props.name,
        item_brand: props.brand,
        item_category: props.category,
        price: props.price,
        quantity: 1,
      }],
    });
  }, [props.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
