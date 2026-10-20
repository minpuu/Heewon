import type { FoodCategory, Restaurant } from "@/domain/types";

/** 카카오 로컬 키워드/카테고리 검색 응답의 documents 항목 중 사용하는 필드 */
export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
}

const CUISINE_BY_SEGMENT: Record<string, FoodCategory> = {
  한식: "korean",
  중식: "chinese",
  일식: "japanese",
  양식: "western",
};

/**
 * 카카오 응답을 앱의 Restaurant로 바꾼다.
 * 카카오가 주지 않는 정보(날것 여부, 대기, 영업 상태, 대표 메뉴)는 만들지 않고 null/unknown으로 둔다.
 */
export function toRestaurantFromKakaoPlace(place: KakaoPlace): Restaurant | null {
  // Number("") 는 0이 되므로 빈 문자열을 먼저 걸러낸다.
  if (!place.x.trim() || !place.y.trim()) return null;
  const latitude = Number(place.y);
  const longitude = Number(place.x);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  // 예: "음식점 > 한식 > 육류,고기 > 돼지고기"
  const segments = place.category_name.split(">").map((segment) => segment.trim());
  const category = CUISINE_BY_SEGMENT[segments[1] ?? ""] ?? "other";
  const subcategory = segments.length > 2 ? segments[segments.length - 1] : undefined;

  return {
    id: `kakao-${place.id}`,
    name: place.place_name,
    category,
    subcategory,
    latitude,
    longitude,
    address: place.road_address_name || place.address_name,
    rawFood: null,
    highWaitingRisk: null,
    openStatus: "unknown",
    externalMapUrl: place.place_url,
    isSample: false,
  };
}
