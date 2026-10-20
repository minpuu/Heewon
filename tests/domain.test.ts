import { describe, expect, it } from "vitest";
import { calculateDistanceMeters } from "@/domain/geo";
import { estimateWalkingMinutes, EstimatedWalkingRouteProvider } from "@/domain/walking";
import { filterRestaurants, groupRestaurantsByCategory } from "@/domain/filter";
import { pickRandomRestaurant } from "@/domain/pick";
import { DEFAULT_EXCLUSIONS, exclusionKey } from "@/domain/exclusions";
import { buildWalkingDirectionsUrl } from "@/domain/mapLink";
import type { Candidate, Restaurant } from "@/domain/types";
import { getNearbyRestaurants, type NearbyDependencies } from "@/services/getNearbyRestaurants";
import { MockRestaurantProvider } from "@/data/mockRestaurantProvider";
import { MOCK_RESTAURANTS } from "@/data/mockRestaurants";
import { PRESET_LOCATIONS } from "@/data/presetLocations";
import { parseWalkMinutes } from "@/config/app";
import { EstimatedWalkingRouteProvider as RouteProvider } from "@/domain/walking";

const mockDependencies: NearbyDependencies = {
  restaurants: new MockRestaurantProvider(),
  routes: new RouteProvider(),
};

const ORIGIN = { latitude: 37.5443, longitude: 126.9516 };

function makeRestaurant(overrides: Partial<Restaurant> & { id: string }): Restaurant {
  return {
    name: overrides.id,
    category: "korean",
    latitude: ORIGIN.latitude,
    longitude: ORIGIN.longitude,
    address: "test",
    rawFood: false,
    highWaitingRisk: false,
    openStatus: "open",
    isSample: true,
    ...overrides,
  };
}

function makeCandidate(id: string, minutes: number, overrides: Partial<Restaurant> = {}): Candidate {
  return {
    restaurant: makeRestaurant({ id, ...overrides }),
    walk: { minutes, meters: minutes * 80, source: "estimate" },
  };
}

describe("calculateDistanceMeters", () => {
  it("returns 0 for identical points", () => {
    expect(calculateDistanceMeters(ORIGIN, ORIGIN)).toBeCloseTo(0, 6);
  });

  it("approximates a 0.001 degree latitude step as about 111 m", () => {
    const d = calculateDistanceMeters(ORIGIN, { latitude: ORIGIN.latitude + 0.001, longitude: ORIGIN.longitude });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it("is symmetric", () => {
    const other = { latitude: 37.5, longitude: 127.03 };
    expect(calculateDistanceMeters(ORIGIN, other)).toBeCloseTo(calculateDistanceMeters(other, ORIGIN), 6);
  });
});

describe("estimateWalkingMinutes", () => {
  it("never returns less than 1 minute", () => {
    expect(estimateWalkingMinutes(0)).toBe(1);
  });

  it("scales with straight-line distance", () => {
    expect(estimateWalkingMinutes(400)).toBeLessThan(estimateWalkingMinutes(800));
  });
});

describe("EstimatedWalkingRouteProvider", () => {
  it("marks its result as an estimate, not a real route", async () => {
    const route = await new EstimatedWalkingRouteProvider().getWalkingRoute(ORIGIN, {
      latitude: ORIGIN.latitude + 0.002,
      longitude: ORIGIN.longitude,
    });
    expect(route?.source).toBe("estimate");
    expect(route?.minutes).toBeGreaterThan(0);
  });
});

describe("filterRestaurants", () => {
  const base = { maxWalkMinutes: 10, ...DEFAULT_EXCLUSIONS };

  it("removes candidates beyond the walk limit", () => {
    const list = [makeCandidate("near", 4), makeCandidate("edge", 10), makeCandidate("far", 11)];
    expect(filterRestaurants(list, base).map((c) => c.restaurant.id)).toEqual(["near", "edge"]);
  });

  it("always removes restaurants that are closed", () => {
    const list = [makeCandidate("closed", 3, { openStatus: "closed" }), makeCandidate("open", 3)];
    expect(filterRestaurants(list, base).map((c) => c.restaurant.id)).toEqual(["open"]);
  });

  it("keeps unknown open status when not closed", () => {
    const list = [makeCandidate("unknown", 3, { openStatus: "unknown" })];
    expect(filterRestaurants(list, base)).toHaveLength(1);
  });

  it("does nothing with raw filter OFF, even when rawFood is true", () => {
    const list = [makeCandidate("raw", 3, { rawFood: true })];
    expect(filterRestaurants(list, base)).toHaveLength(1);
  });

  it("with raw filter ON, excludes raw and also unknown (null) restaurants", () => {
    const list = [
      makeCandidate("raw", 3, { rawFood: true }),
      makeCandidate("unknown", 3, { rawFood: null }),
      makeCandidate("safe", 3, { rawFood: false }),
    ];
    const result = filterRestaurants(list, { ...base, excludeRaw: true });
    expect(result.map((c) => c.restaurant.id)).toEqual(["safe"]);
  });

  it("with waiting filter ON, excludes high-waiting and unknown (null) restaurants", () => {
    const list = [
      makeCandidate("busy", 3, { highWaitingRisk: true }),
      makeCandidate("unknown", 3, { highWaitingRisk: null }),
      makeCandidate("calm", 3, { highWaitingRisk: false }),
    ];
    const result = filterRestaurants(list, { ...base, excludeHighWaiting: true });
    expect(result.map((c) => c.restaurant.id)).toEqual(["calm"]);
  });

  it("applies both filters together", () => {
    const list = [
      makeCandidate("raw-busy", 3, { rawFood: true, highWaitingRisk: true }),
      makeCandidate("calm-safe", 3, { rawFood: false, highWaitingRisk: false }),
      makeCandidate("calm-raw", 3, { rawFood: true, highWaitingRisk: false }),
    ];
    const result = filterRestaurants(list, { ...base, excludeRaw: true, excludeHighWaiting: true });
    expect(result.map((c) => c.restaurant.id)).toEqual(["calm-safe"]);
  });
});

describe("groupRestaurantsByCategory", () => {
  it("groups by category and keeps the full list", () => {
    const list = [
      makeCandidate("a", 2, { category: "korean" }),
      makeCandidate("b", 2, { category: "japanese" }),
      makeCandidate("c", 2, { category: "korean" }),
    ];
    const groups = groupRestaurantsByCategory(list);
    expect(groups.all).toHaveLength(3);
    expect(groups.byCategory.korean).toHaveLength(2);
    expect(groups.byCategory.japanese).toHaveLength(1);
    expect(groups.byCategory.chinese).toHaveLength(0);
  });
});

describe("pickRandomRestaurant", () => {
  const list = [makeCandidate("a", 2), makeCandidate("b", 2), makeCandidate("c", 2)];

  it("returns null when there are no candidates", () => {
    expect(pickRandomRestaurant([], { shownIds: new Set() })).toBeNull();
  });

  it("never repeats an already shown restaurant while fresh ones remain", () => {
    const shown = new Set(["a"]);
    for (let i = 0; i < 50; i++) {
      const result = pickRandomRestaurant(list, { shownIds: shown, random: Math.random });
      expect(result?.candidate.restaurant.id).not.toBe("a");
      expect(result?.historyReset).toBe(false);
    }
  });

  it("avoids the previous restaurant when other options exist", () => {
    for (let i = 0; i < 50; i++) {
      const result = pickRandomRestaurant(list, { shownIds: new Set(["a"]), previousId: "b" });
      expect(result?.candidate.restaurant.id).toBe("c");
    }
  });

  it("resets history when every candidate has been shown", () => {
    const result = pickRandomRestaurant(list, { shownIds: new Set(["a", "b", "c"]), previousId: "c" });
    expect(result?.historyReset).toBe(true);
    expect(result?.candidate.restaurant.id).not.toBe("c");
  });

  it("warns when only one candidate exists and it was the previous pick", () => {
    const single = [makeCandidate("only", 2)];
    const result = pickRandomRestaurant(single, { shownIds: new Set(["only"]), previousId: "only" });
    expect(result?.candidate.restaurant.id).toBe("only");
    expect(result?.sameAsPrevious).toBe(true);
  });

  it("uses an injected random source to choose deterministically", () => {
    const first = pickRandomRestaurant(list, { shownIds: new Set(), random: () => 0 });
    const last = pickRandomRestaurant(list, { shownIds: new Set(), random: () => 0.999 });
    expect(first?.candidate.restaurant.id).toBe("a");
    expect(last?.candidate.restaurant.id).toBe("c");
  });
});

describe("exclusionKey", () => {
  it("differs for different exclusion combinations", () => {
    const keys = new Set([
      exclusionKey({ excludeRaw: false, excludeHighWaiting: false }),
      exclusionKey({ excludeRaw: true, excludeHighWaiting: false }),
      exclusionKey({ excludeRaw: false, excludeHighWaiting: true }),
      exclusionKey({ excludeRaw: true, excludeHighWaiting: true }),
    ]);
    expect(keys.size).toBe(4);
  });
});

describe("getNearbyRestaurants (mock data)", () => {
  it("returns candidates with walking info, sorted by walking distance", async () => {
    const candidates = await getNearbyRestaurants(ORIGIN, mockDependencies);
    expect(candidates.length).toBeGreaterThan(0);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i].walk.meters).toBeGreaterThanOrEqual(candidates[i - 1].walk.meters);
    }
    expect(candidates.every((c) => c.walk.source === "estimate")).toBe(true);
  });

  it("covers every food category in the sample data", () => {
    const categories = new Set(MOCK_RESTAURANTS.map((r) => r.category));
    expect(categories).toEqual(new Set(["korean", "chinese", "japanese", "western", "other"]));
  });

  it("has a closed restaurant that is filtered out for a 15 minute search", async () => {
    const candidates = await getNearbyRestaurants(ORIGIN, mockDependencies);
    const result = filterRestaurants(candidates, { maxWalkMinutes: 15, ...DEFAULT_EXCLUSIONS });
    expect(result.some((c) => c.restaurant.openStatus === "closed")).toBe(false);
  });

  it("returns nothing for a far-away origin (empty state path)", async () => {
    const candidates = await getNearbyRestaurants({ latitude: 35.1, longitude: 129.0 }, mockDependencies);
    expect(candidates).toEqual([]);
  });

  it("keeps each preset location inside the provider's search radius", async () => {
    for (const preset of PRESET_LOCATIONS) {
      const restaurants = await new MockRestaurantProvider().searchNearby(preset, 2000);
      expect(restaurants.length).toBeGreaterThan(0);
    }
  });
});

describe("buildWalkingDirectionsUrl", () => {
  it("points walking directions at the restaurant coordinates", () => {
    const url = new URL(buildWalkingDirectionsUrl({ latitude: 37.5, longitude: 127 }));
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("destination")).toBe("37.5,127");
    expect(url.searchParams.get("travelmode")).toBe("walking");
  });
});

describe("parseWalkMinutes", () => {
  it("accepts only supported options and falls back to the default", () => {
    expect(parseWalkMinutes("5")).toBe(5);
    expect(parseWalkMinutes("15")).toBe(15);
    expect(parseWalkMinutes("7")).toBe(10);
    expect(parseWalkMinutes(undefined)).toBe(10);
    expect(parseWalkMinutes(["5", "10"])).toBe(5);
  });
});
