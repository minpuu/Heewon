import { readJson, writeJson } from "./storage";

const KEY = "pick-history";

interface StoredHistory {
  /** 거리·제외 조건 조합. 바뀌면 이력을 버린다. */
  scope: string;
  shownIds: string[];
  previousId?: string;
}

export interface PickHistory {
  shownIds: Set<string>;
  previousId?: string;
}

/** 같은 세션(탭)에서 같은 조건일 때만 이력을 이어서 쓴다. */
export function loadPickHistory(scope: string): PickHistory {
  const stored = readJson<StoredHistory>("session", KEY);
  if (!stored || stored.scope !== scope) {
    return { shownIds: new Set() };
  }
  return { shownIds: new Set(stored.shownIds), previousId: stored.previousId };
}

export function savePickHistory(scope: string, history: PickHistory): void {
  const stored: StoredHistory = {
    scope,
    shownIds: [...history.shownIds],
    previousId: history.previousId,
  };
  writeJson("session", KEY, stored);
}
