import { describe, expect, it } from "vitest";
import { toRestaurantFromKakaoPlace, type KakaoPlace } from "@/data/kakaoMapping";

const place = (overrides: Partial<KakaoPlace> = {}): KakaoPlace => ({
  id: "123",
  place_name: "테스트 국밥",
  category_name: "음식점 > 한식 > 국밥",
  address_name: "서울 마포구 공덕동 1-1",
  road_address_name: "서울 마포구 백범로 1",
  x: "126.9516",
  y: "37.5443",
  place_url: "https://place.map.kakao.com/123",
  ...overrides,
});

describe("toRestaurantFromKakaoPlace", () => {
  it("maps coordinates, names, road address and place URL", () => {
    const r = toRestaurantFromKakaoPlace(place());
    expect(r).toMatchObject({
      id: "kakao-123",
      name: "테스트 국밥",
      latitude: 37.5443,
      longitude: 126.9516,
      address: "서울 마포구 백범로 1",
      externalMapUrl: "https://place.map.kakao.com/123",
      isSample: false,
    });
  });

  it("falls back to the lot-number address when no road address exists", () => {
    expect(toRestaurantFromKakaoPlace(place({ road_address_name: "" }))?.address).toBe("서울 마포구 공덕동 1-1");
  });

  it.each([
    ["음식점 > 한식 > 국밥", "korean"],
    ["음식점 > 중식 > 중국요리", "chinese"],
    ["음식점 > 일식 > 초밥,롤", "japanese"],
    ["음식점 > 양식 > 스테이크", "western"],
    ["음식점 > 카페 > 커피전문점", "other"],
    ["음식점", "other"],
  ])("maps %s to %s", (categoryName, expected) => {
    expect(toRestaurantFromKakaoPlace(place({ category_name: categoryName }))?.category).toBe(expected);
  });

  it("uses the last segment as subcategory and leaves it out for short names", () => {
    expect(toRestaurantFromKakaoPlace(place())?.subcategory).toBe("국밥");
    expect(toRestaurantFromKakaoPlace(place({ category_name: "음식점" }))?.subcategory).toBeUndefined();
  });

  it("never invents data Kakao does not provide", () => {
    const r = toRestaurantFromKakaoPlace(place());
    expect(r?.rawFood).toBeNull();
    expect(r?.highWaitingRisk).toBeNull();
    expect(r?.openStatus).toBe("unknown");
    expect(r?.representativeMenu).toBeUndefined();
  });

  it("drops places with unusable coordinates", () => {
    expect(toRestaurantFromKakaoPlace(place({ x: "", y: "" }))).toBeNull();
  });
});
