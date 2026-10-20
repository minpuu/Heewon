/**
 * 제외 조건. 모두 기본값 OFF.
 * 켜져 있을 때는 "확인된 정보가 있는 식당"만 통과시킨다.
 * 미확인(null) 식당은 안전하다고 간주하지 않고 제외한다.
 */
export interface ExclusionSettings {
  excludeRaw: boolean;
  excludeHighWaiting: boolean;
}

export const DEFAULT_EXCLUSIONS: ExclusionSettings = {
  excludeRaw: false,
  excludeHighWaiting: false,
};

/** 후보 캐시·세션 이력을 구분하는 키. */
export function exclusionKey(settings: ExclusionSettings): string {
  return `raw:${settings.excludeRaw ? 1 : 0}|wait:${settings.excludeHighWaiting ? 1 : 0}`;
}
