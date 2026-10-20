import type { FoodCategory, OpenStatus, Restaurant } from "@/domain/types";

/**
 * 가상의 샘플 식당 데이터.
 * 실제 가게가 아니며, 이름·주소·영업 정보는 모두 임의로 만든 것이다.
 * rawFood / highWaitingRisk 의 null 은 "정보 미확인"을 뜻한다.
 */
interface SampleSeed {
  id: string;
  name: string;
  category: FoodCategory;
  subcategory?: string;
  representativeMenu?: string;
  latitude: number;
  longitude: number;
  rawFood: boolean | null;
  highWaitingRisk: boolean | null;
  openStatus: OpenStatus;
}

const SEEDS: SampleSeed[] = [
  // 공덕 기준점 주변
  { id: "s-01", name: "소소라멘", category: "japanese", subcategory: "라멘", representativeMenu: "돈코츠 라멘", latitude: 37.5455, longitude: 126.9525, rawFood: false, highWaitingRisk: false, openStatus: "open" },
  { id: "s-02", name: "공덕국밥", category: "korean", subcategory: "국밥", representativeMenu: "순대국밥", latitude: 37.5438, longitude: 126.9509, rawFood: false, highWaitingRisk: null, openStatus: "unknown" },
  { id: "s-03", name: "미미반점", category: "chinese", subcategory: "중화요리", representativeMenu: "짜장면", latitude: 37.5463, longitude: 126.9538, rawFood: false, highWaitingRisk: true, openStatus: "open" },
  { id: "s-04", name: "바다회식당", category: "japanese", subcategory: "회", representativeMenu: "모듬회", latitude: 37.5421, longitude: 126.9532, rawFood: true, highWaitingRisk: false, openStatus: "open" },
  { id: "s-05", name: "파스타하우스", category: "western", subcategory: "파스타", representativeMenu: "봉골레 파스타", latitude: 37.543, longitude: 126.9497, rawFood: false, highWaitingRisk: false, openStatus: "unknown" },
  { id: "s-06", name: "육회한접시", category: "korean", subcategory: "육회", representativeMenu: "육회", latitude: 37.5449, longitude: 126.9489, rawFood: true, highWaitingRisk: null, openStatus: "open" },
  { id: "s-07", name: "동네분식", category: "other", subcategory: "분식", representativeMenu: "떡볶이", latitude: 37.547, longitude: 126.9507, rawFood: false, highWaitingRisk: null, openStatus: "open" },
  { id: "s-08", name: "쉬는날베이커리", category: "other", subcategory: "베이커리", representativeMenu: "샌드위치", latitude: 37.5436, longitude: 126.9548, rawFood: null, highWaitingRisk: false, openStatus: "open" },
  { id: "s-09", name: "영업종료 샘플 식당", category: "korean", subcategory: "백반", representativeMenu: "제육볶음", latitude: 37.5448, longitude: 126.9523, rawFood: false, highWaitingRisk: false, openStatus: "closed" },
  { id: "s-10", name: "조금 먼 샘플 스테이크", category: "western", subcategory: "스테이크", representativeMenu: "립아이 스테이크", latitude: 37.56, longitude: 126.95, rawFood: false, highWaitingRisk: false, openStatus: "open" },
  { id: "s-11", name: "골목 김치찌개", category: "korean", subcategory: "찌개", representativeMenu: "김치찌개", latitude: 37.5439, longitude: 126.9519, rawFood: false, highWaitingRisk: false, openStatus: "open" },
  { id: "s-12", name: "마라하우스", category: "chinese", subcategory: "마라", representativeMenu: "마라탕", latitude: 37.5445, longitude: 126.9535, rawFood: false, highWaitingRisk: true, openStatus: "open" },
  // 역삼 기준점 주변
  { id: "s-13", name: "역삼 정식당", category: "korean", subcategory: "정식", representativeMenu: "한식 정식", latitude: 37.5012, longitude: 127.0371, rawFood: false, highWaitingRisk: false, openStatus: "open" },
  { id: "s-14", name: "역삼 쌀국수", category: "other", subcategory: "베트남식", representativeMenu: "소고기 쌀국수", latitude: 37.4998, longitude: 127.0357, rawFood: false, highWaitingRisk: null, openStatus: "open" },
  { id: "s-15", name: "역삼 초밥바", category: "japanese", subcategory: "초밥", representativeMenu: "오마카세 초밥", latitude: 37.5019, longitude: 127.0348, rawFood: true, highWaitingRisk: false, openStatus: "open" },
  { id: "s-16", name: "역삼 짬뽕집", category: "chinese", subcategory: "중화요리", representativeMenu: "짬뽕", latitude: 37.5003, longitude: 127.038, rawFood: false, highWaitingRisk: false, openStatus: "open" },
  { id: "s-17", name: "역삼 브런치", category: "western", subcategory: "브런치", representativeMenu: "에그 샐러드", latitude: 37.5025, longitude: 127.0362, rawFood: null, highWaitingRisk: null, openStatus: "unknown" },
  // 명동 기준점 주변
  { id: "s-18", name: "명동 칼국수", category: "korean", subcategory: "칼국수", representativeMenu: "바지락 칼국수", latitude: 37.5641, longitude: 126.9833, rawFood: false, highWaitingRisk: true, openStatus: "open" },
  { id: "s-19", name: "명동 샤브샤브", category: "other", subcategory: "샤브샤브", representativeMenu: "샤브샤브 정식", latitude: 37.5629, longitude: 126.9819, rawFood: false, highWaitingRisk: false, openStatus: "open" },
  { id: "s-20", name: "명동 오일파스타", category: "western", subcategory: "파스타", representativeMenu: "오일 파스타", latitude: 37.5632, longitude: 126.984, rawFood: false, highWaitingRisk: false, openStatus: "open" },
  { id: "s-21", name: "명동 초밥", category: "japanese", subcategory: "초밥", representativeMenu: "회 초밥 세트", latitude: 37.5645, longitude: 126.9809, rawFood: true, highWaitingRisk: null, openStatus: "open" },
  { id: "s-22", name: "명동 마라샹궈", category: "chinese", subcategory: "마라", representativeMenu: "마라샹궈", latitude: 37.5638, longitude: 126.9848, rawFood: false, highWaitingRisk: null, openStatus: "open" },
];

export const MOCK_RESTAURANTS: Restaurant[] = SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  category: seed.category,
  subcategory: seed.subcategory,
  representativeMenu: seed.representativeMenu,
  latitude: seed.latitude,
  longitude: seed.longitude,
  address: `가상 주소 · ${seed.id.toUpperCase()}`,
  rawFood: seed.rawFood,
  highWaitingRisk: seed.highWaitingRisk,
  openStatus: seed.openStatus,
  isSample: true,
}));
