import type { Coordinates, Restaurant } from "@/domain/types";
import { calculateDistanceMeters } from "@/domain/geo";
import { MOCK_RESTAURANTS } from "./mockRestaurants";
import type { RestaurantProvider } from "./restaurantProvider";

/** 외부 API 키 없이 전체 흐름을 테스트하기 위한 Mock 제공자. */
export class MockRestaurantProvider implements RestaurantProvider {
  async searchNearby(center: Coordinates, radiusMeters: number): Promise<Restaurant[]> {
    return MOCK_RESTAURANTS.filter(
      (restaurant) => calculateDistanceMeters(center, restaurant) <= radiusMeters,
    );
  }
}
