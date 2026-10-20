import type { Coordinates, Restaurant } from "@/domain/types";

/**
 * 식당 데이터 제공자. 실제 장소 API 연결 시 이 인터페이스를 구현한다.
 * 반환값은 반경(직선거리) 안의 식당 목록이며, 도보 시간 필터링은 상위 계층에서 한다.
 */
export interface RestaurantProvider {
  searchNearby(center: Coordinates, radiusMeters: number): Promise<Restaurant[]>;
}
