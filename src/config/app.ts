/**
 * 앱 전역 설정.
 * 서비스명은 아직 확정되지 않았으므로 임시 이름을 한 곳에서만 관리한다.
 */
export const APP_NAME = "오늘 어디";

/** 사용자가 고를 수 있는 도보 시간(분). 단일 선택. */
export const WALK_MINUTE_OPTIONS = [5, 10, 15] as const;
export type WalkMinutes = (typeof WALK_MINUTE_OPTIONS)[number];

export const DEFAULT_WALK_MINUTES: WalkMinutes = 10;

/**
 * 1차 조회 반경(직선거리, m).
 * 가장 긴 도보 옵션(15분)을 넘기지 않도록 여유를 두고 잡는다.
 * 실제 도보 시간 필터링은 domain/filter.ts 에서 수행한다.
 */
export const SEARCH_RADIUS_METERS = 2000;

/** URL 쿼리 값을 허용된 도보 시간으로 바꾼다. 잘못된 값이면 기본값. */
export function parseWalkMinutes(value: string | string[] | undefined): WalkMinutes {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return (WALK_MINUTE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as WalkMinutes)
    : DEFAULT_WALK_MINUTES;
}
