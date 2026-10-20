import { CATEGORY_LABEL } from "@/domain/filter";
import type { Restaurant, WalkingRoute } from "@/domain/types";

/** "한식 · 국밥" 형태의 음식 분류 텍스트 */
export function formatCategory(restaurant: Pick<Restaurant, "category" | "subcategory">): string {
  const base = CATEGORY_LABEL[restaurant.category];
  return restaurant.subcategory ? `${base} · ${restaurant.subcategory}` : base;
}

/**
 * 도보 시간 텍스트.
 * 추정치(estimate)와 경로 API 값(route) 모두 "약 N분"으로 표시한다.
 */
export function formatWalk(walk: WalkingRoute): string {
  return `도보 약 ${walk.minutes}분`;
}

/** 영업 상태 텍스트. 확인되지 않은 경우 null (표시하지 않음). */
export function formatOpenStatus(status: Restaurant["openStatus"]): string | null {
  if (status === "open") return "영업 중";
  return null;
}
