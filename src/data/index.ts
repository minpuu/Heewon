import type { WalkingRouteProvider } from "@/domain/walking";
import { EstimatedWalkingRouteProvider } from "@/domain/walking";
import { MockRestaurantProvider } from "./mockRestaurantProvider";
import type { RestaurantProvider } from "./restaurantProvider";

/**
 * 현재는 Mock 제공자만 사용한다.
 * 실제 장소·경로 API를 연결하면 여기서 교체한다. (API 키는 서버 측 환경변수로만 다룬다.)
 */
export const restaurantProvider: RestaurantProvider = new MockRestaurantProvider();
export const walkingRouteProvider: WalkingRouteProvider = new EstimatedWalkingRouteProvider();
