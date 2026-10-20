import type { Coordinates, Restaurant } from "@/domain/types";
import type { RestaurantProvider } from "./restaurantProvider";

interface NearbyResponse {
  source: "kakao" | "mock";
  restaurants: Restaurant[];
}

/**
 * 브라우저에서 서버 라우트를 통해 식당을 가져온다.
 * API 키는 서버에만 있고 브라우저에는 노출되지 않는다.
 */
export class HttpRestaurantProvider implements RestaurantProvider {
  constructor(private readonly endpoint: string) {}

  async searchNearby(center: Coordinates): Promise<Restaurant[]> {
    const params = new URLSearchParams({
      lat: String(center.latitude),
      lng: String(center.longitude),
    });
    const response = await fetch(`${this.endpoint}?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Restaurant request failed: ${response.status}`);
    }
    const body = (await response.json()) as NearbyResponse;
    return body.restaurants;
  }
}
