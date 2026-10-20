import type { Coordinates, Restaurant } from "@/domain/types";
import type { RestaurantProvider } from "./restaurantProvider";
import { toRestaurantFromKakaoPlace, type KakaoPlace } from "./kakaoMapping";

const ENDPOINT = "https://dapi.kakao.com/v2/local/search/category.json";
/** 음식점 카테고리 그룹 코드 */
const FOOD_CATEGORY_GROUP = "FD6";
/** 카카오 API: 한 페이지 최대 15건, 최대 3페이지 */
const PAGE_SIZE = 15;
const MAX_PAGES = 3;

interface KakaoCategoryResponse {
  documents: KakaoPlace[];
  meta: { is_end: boolean };
}

/**
 * 카카오 로컬 API 제공자. 서버에서만 실행한다. (REST API 키는 클라이언트에 노출하지 않는다)
 */
export class KakaoRestaurantProvider implements RestaurantProvider {
  constructor(private readonly restApiKey: string) {}

  async searchNearby(center: Coordinates, radiusMeters: number): Promise<Restaurant[]> {
    // 카카오 반경 검색 상한은 20,000m
    const radius = Math.min(Math.round(radiusMeters), 20_000);
    const restaurants: Restaurant[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const params = new URLSearchParams({
        category_group_code: FOOD_CATEGORY_GROUP,
        x: String(center.longitude),
        y: String(center.latitude),
        radius: String(radius),
        sort: "distance",
        size: String(PAGE_SIZE),
        page: String(page),
      });

      const response = await fetch(`${ENDPOINT}?${params.toString()}`, {
        headers: { Authorization: `KakaoAK ${this.restApiKey}` },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Kakao local search failed: ${response.status}`);
      }

      const body = (await response.json()) as KakaoCategoryResponse;
      for (const place of body.documents) {
        const restaurant = toRestaurantFromKakaoPlace(place);
        if (restaurant) restaurants.push(restaurant);
      }
      if (body.meta.is_end) break;
    }

    return restaurants;
  }
}
