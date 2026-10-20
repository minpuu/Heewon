import type { WalkingRouteProvider } from "@/domain/walking";
import { EstimatedWalkingRouteProvider } from "@/domain/walking";
import { HttpRestaurantProvider } from "./httpRestaurantProvider";
import type { RestaurantProvider } from "./restaurantProvider";

/**
 * 브라우저가 쓰는 식당 제공자. 실제 데이터 소스는 서버 라우트에서 고른다 (serverRestaurantProvider.ts).
 */
export const restaurantProvider: RestaurantProvider = new HttpRestaurantProvider("/api/restaurants/nearby");
export const walkingRouteProvider: WalkingRouteProvider = new EstimatedWalkingRouteProvider();
