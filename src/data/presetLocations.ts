import type { Coordinates } from "@/domain/types";

export interface PresetLocation extends Coordinates {
  id: string;
  label: string;
}

/**
 * 테스트용 기준 위치. 위치 권한이 없거나 개발 환경에서 사용한다.
 * 실제 주소 검색 기능이 연결되기 전까지의 임시 목록이다.
 */
export const PRESET_LOCATIONS: PresetLocation[] = [
  { id: "gongdeok", label: "서울 마포구 공덕동", latitude: 37.5443, longitude: 126.9516 },
  { id: "yeoksam", label: "서울 강남구 역삼동", latitude: 37.5006, longitude: 127.0365 },
  { id: "myeongdong", label: "서울 중구 명동", latitude: 37.5636, longitude: 126.9826 },
];

export const DEFAULT_PRESET_ID = "gongdeok";
