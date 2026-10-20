import { SEARCH_RADIUS_METERS } from "@/config/app";
import type { Candidate, Coordinates } from "@/domain/types";
import { restaurantProvider, walkingRouteProvider } from "@/data";
import type { RestaurantProvider } from "@/data/restaurantProvider";
import type { WalkingRouteProvider } from "@/domain/walking";

export interface NearbyDependencies {
  restaurants: RestaurantProvider;
  routes: WalkingRouteProvider;
}

const defaultDependencies: NearbyDependencies = {
  restaurants: restaurantProvider,
  routes: walkingRouteProvider,
};

/**
 * 출발지 주변 식당을 도보 정보와 함께 가져온다.
 * 도보 경로를 구할 수 없는 식당은 후보에서 뺀다.
 * 결과는 도보 거리가 가까운 순서로 정렬한다.
 */
export async function getNearbyRestaurants(
  origin: Coordinates,
  dependencies: NearbyDependencies = defaultDependencies,
): Promise<Candidate[]> {
  const restaurants = await dependencies.restaurants.searchNearby(origin, SEARCH_RADIUS_METERS);

  const routes = await Promise.all(
    restaurants.map((restaurant) => dependencies.routes.getWalkingRoute(origin, restaurant)),
  );

  const candidates: Candidate[] = [];
  restaurants.forEach((restaurant, index) => {
    const walk = routes[index];
    if (walk) candidates.push({ restaurant, walk });
  });

  return candidates.sort((a, b) => a.walk.meters - b.walk.meters);
}
