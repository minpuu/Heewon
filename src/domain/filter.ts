import type { Candidate, FoodCategory, Restaurant } from "./types";
import type { ExclusionSettings } from "./exclusions";

export const CATEGORY_ORDER: FoodCategory[] = ["korean", "chinese", "japanese", "western", "other"];

export const CATEGORY_LABEL: Record<FoodCategory, string> = {
  korean: "한식",
  chinese: "중식",
  japanese: "일식",
  western: "양식",
  other: "기타",
};

export interface FilterOptions extends ExclusionSettings {
  maxWalkMinutes: number;
}

/** 제외 조건 1개를 통과하는지. 켜진 조건에서 미확인(null)은 통과시키지 않는다. */
function passesExclusions(restaurant: Restaurant, settings: ExclusionSettings): boolean {
  if (restaurant.openStatus === "closed") return false;
  if (settings.excludeRaw && restaurant.rawFood !== false) return false;
  if (settings.excludeHighWaiting && restaurant.highWaitingRisk !== false) return false;
  return true;
}

/**
 * 도보 시간·영업 종료·제외 조건을 적용한 후보만 남긴다.
 * 도보 시간은 직선거리 기반 추정치이므로 정확한 필터링을 보장하지 않는다.
 */
export function filterRestaurants(candidates: Candidate[], options: FilterOptions): Candidate[] {
  return candidates.filter(
    ({ restaurant, walk }) =>
      walk.minutes <= options.maxWalkMinutes && passesExclusions(restaurant, options),
  );
}

export interface CategoryGroups {
  all: Candidate[];
  byCategory: Record<FoodCategory, Candidate[]>;
}

/** 목록 화면의 카테고리 탭과 식당 수 표시에 사용한다. */
export function groupRestaurantsByCategory(candidates: Candidate[]): CategoryGroups {
  const byCategory: Record<FoodCategory, Candidate[]> = {
    korean: [],
    chinese: [],
    japanese: [],
    western: [],
    other: [],
  };
  for (const candidate of candidates) {
    byCategory[candidate.restaurant.category].push(candidate);
  }
  return { all: candidates, byCategory };
}
