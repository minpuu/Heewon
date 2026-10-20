export type FoodCategory = "korean" | "chinese" | "japanese" | "western" | "other";

/** 영업 상태. "unknown"은 확인 불가이며 영업 종료와 구분한다. */
export type OpenStatus = "open" | "closed" | "unknown";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Restaurant extends Coordinates {
  id: string;
  name: string;
  category: FoodCategory;
  subcategory?: string;
  representativeMenu?: string;
  address: string;
  /** 날것(회·육회 등) 중심 여부. null = 정보 미확인 */
  rawFood: boolean | null;
  /** 대기가 잦은 것으로 확인된 식당인지. null = 정보 미확인 */
  highWaitingRisk: boolean | null;
  openStatus: OpenStatus;
  externalMapUrl?: string;
  /** Mock 데이터 여부. UI에서 샘플임을 표시하는 데 사용한다. */
  isSample: boolean;
}

/**
 * 도보 경로 정보.
 * - "estimate": 좌표 기반 직선거리로 추정한 값 (실제 보행 경로 아님)
 * - "route": 보행 경로 API가 반환한 값
 */
export interface WalkingRoute {
  minutes: number;
  meters: number;
  source: "estimate" | "route";
}

/** 식당과 출발지 사이의 도보 정보를 붙인 후보. */
export interface Candidate {
  restaurant: Restaurant;
  walk: WalkingRoute;
}
