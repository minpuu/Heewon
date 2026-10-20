import type { Restaurant } from "./types";

/**
 * 외부 지도 앱에서 해당 식당 좌표까지의 도보 길찾기를 연다.
 * 샘플 식당의 좌표는 실제 가게 위치가 아니므로 길찾기 결과는 테스트용이다.
 */
export function buildWalkingDirectionsUrl(restaurant: Pick<Restaurant, "latitude" | "longitude">): string {
  const destination = `${restaurant.latitude},${restaurant.longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
}
