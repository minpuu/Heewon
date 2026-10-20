import type { RestaurantProvider } from "./restaurantProvider";
import { KakaoRestaurantProvider } from "./kakaoRestaurantProvider";
import { MockRestaurantProvider } from "./mockRestaurantProvider";

export type RestaurantSource = "kakao" | "mock";

/**
 * 서버 측 제공자 선택.
 * KAKAO_REST_API_KEY 가 있으면 카카오, 없으면 Mock 을 쓴다.
 */
export function getServerRestaurantProvider(): { source: RestaurantSource; provider: RestaurantProvider } {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (key) {
    return { source: "kakao", provider: new KakaoRestaurantProvider(key) };
  }
  return { source: "mock", provider: new MockRestaurantProvider() };
}
