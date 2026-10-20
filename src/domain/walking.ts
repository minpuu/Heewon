import type { Coordinates, WalkingRoute } from "./types";
import { calculateDistanceMeters } from "./geo";

/**
 * 직선거리 → 도보 시간 추정 상수.
 * 실제 보행 경로 API 연결 전까지만 사용한다.
 */
/** 보행 속도 약 4.8km/h */
const WALK_SPEED_METERS_PER_MINUTE = 80;
/** 직선거리 대비 실제 보행 경로 우회 계수 (도로 구조에 따른 평균 추정치) */
const DETOUR_FACTOR = 1.2;

/** 직선거리 기반 도보 시간 추정(분). 최소 1분. */
export function estimateWalkingMinutes(straightLineMeters: number): number {
  const estimatedRouteMeters = straightLineMeters * DETOUR_FACTOR;
  return Math.max(1, Math.round(estimatedRouteMeters / WALK_SPEED_METERS_PER_MINUTE));
}

/** 실제 보행 경로를 제공하는 외부 API를 연결할 때 구현하는 인터페이스. */
export interface WalkingRouteProvider {
  getWalkingRoute(origin: Coordinates, destination: Coordinates): Promise<WalkingRoute | null>;
}

/**
 * Mock 단계용 구현. 직선거리로 추정하며 source를 "estimate"로 표시한다.
 * 정확한 보행 시간 필터링을 보장하지 않는다.
 */
export class EstimatedWalkingRouteProvider implements WalkingRouteProvider {
  async getWalkingRoute(origin: Coordinates, destination: Coordinates): Promise<WalkingRoute> {
    const straightLineMeters = calculateDistanceMeters(origin, destination);
    return {
      minutes: estimateWalkingMinutes(straightLineMeters),
      meters: Math.round(straightLineMeters),
      source: "estimate",
    };
  }
}
