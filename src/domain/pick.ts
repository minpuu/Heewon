import type { Candidate } from "./types";

export interface PickOptions {
  /** 이번 세션에서 이미 추천한 식당 id */
  shownIds: ReadonlySet<string>;
  /** 직전에 보여준 식당 id. 후보가 둘 이상이면 같은 식당을 피한다. */
  previousId?: string;
  /** 테스트용 난수 생성기. 기본값은 Math.random. */
  random?: () => number;
}

export interface PickResult {
  candidate: Candidate;
  /** 모든 후보를 한 번씩 보여줘서 이력을 초기화하고 다시 뽑았는지 */
  historyReset: boolean;
  /** 후보가 하나뿐이라 직전과 같은 식당이 나왔는지 */
  sameAsPrevious: boolean;
}

function pickOne(pool: Candidate[], random: () => number): Candidate {
  const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
  return pool[index];
}

/**
 * 아직 추천하지 않은 후보 중 균등 랜덤으로 한 곳을 고른다.
 * 후보가 없으면 null을 반환한다.
 */
export function pickRandomRestaurant(
  candidates: Candidate[],
  options: PickOptions,
): PickResult | null {
  if (candidates.length === 0) return null;

  const random = options.random ?? Math.random;
  const notPrevious = (c: Candidate) => c.restaurant.id !== options.previousId;

  const fresh = candidates.filter(
    (c) => !options.shownIds.has(c.restaurant.id) && notPrevious(c),
  );
  if (fresh.length > 0) {
    return {
      candidate: pickOne(fresh, random),
      historyReset: false,
      sameAsPrevious: false,
    };
  }

  // 모든 후보를 소진한 경우: 이력을 초기화하고 직전 식당만 피한다.
  const others = candidates.filter(notPrevious);
  if (others.length > 0) {
    return {
      candidate: pickOne(others, random),
      historyReset: true,
      sameAsPrevious: false,
    };
  }

  // 후보가 하나뿐이면 같은 식당이 나올 수 있다.
  return {
    candidate: pickOne(candidates, random),
    historyReset: true,
    sameAsPrevious: true,
  };
}
