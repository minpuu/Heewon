"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Candidate } from "@/domain/types";
import { pickRandomRestaurant, type PickResult } from "@/domain/pick";
import { loadPickHistory, savePickHistory, type PickHistory } from "@/lib/pickHistory";

export type PickStatus = "loading" | "empty" | "ready";

export interface PickSession {
  status: PickStatus;
  current: Candidate | null;
  historyReset: boolean;
  sameAsPrevious: boolean;
  repick: () => void;
}

interface PickSessionOptions {
  /** 필터가 끝난 후보. null이면 아직 준비 중이다. */
  candidates: Candidate[] | null;
  /** 거리·제외 조건 조합. 이력은 같은 scope 안에서만 이어진다. */
  scope: string;
  /** 목록에서 "여기로 결정"으로 들어온 경우의 식당 id */
  fixedId?: string;
}

function recordShown(scope: string, history: PickHistory, candidate: Candidate): PickHistory {
  const next: PickHistory = {
    shownIds: new Set(history.shownIds).add(candidate.restaurant.id),
    previousId: candidate.restaurant.id,
  };
  savePickHistory(scope, next);
  return next;
}

/**
 * 결과 화면의 "한 곳 결정" 상태를 관리한다.
 * 추천 알고리즘은 domain/pick.ts 에 있으며, 여기서는 세션 이력과 화면 상태만 다룬다.
 */
export function usePickSession({ candidates, scope, fixedId }: PickSessionOptions): PickSession {
  const [current, setCurrent] = useState<Candidate | null>(null);
  const [status, setStatus] = useState<PickStatus>("loading");
  const [notice, setNotice] = useState<Pick<PickResult, "historyReset" | "sameAsPrevious">>({
    historyReset: false,
    sameAsPrevious: false,
  });
  /** 마지막으로 뽑기를 수행한 후보 목록. 목록이 바뀌면(예: 제외 조건 변경) 다시 뽑는다. */
  const pickedFrom = useRef<Candidate[] | null>(null);

  const applyPick = useCallback(
    (list: Candidate[]) => {
      const history = loadPickHistory(scope);
      const result = pickRandomRestaurant(list, {
        shownIds: history.shownIds,
        previousId: history.previousId,
      });
      if (!result) {
        setCurrent(null);
        setStatus("empty");
        return;
      }
      // 모든 후보를 소진했다면 이력을 비운 뒤 기록한다.
      const base: PickHistory = result.historyReset ? { shownIds: new Set() } : history;
      recordShown(scope, base, result.candidate);
      setCurrent(result.candidate);
      setNotice({ historyReset: result.historyReset, sameAsPrevious: result.sameAsPrevious });
      setStatus("ready");
    },
    [scope],
  );

  useEffect(() => {
    if (candidates === null || pickedFrom.current === candidates) return;
    pickedFrom.current = candidates;

    const fixed = fixedId ? candidates.find((c) => c.restaurant.id === fixedId) : undefined;
    if (fixed) {
      recordShown(scope, loadPickHistory(scope), fixed);
      setCurrent(fixed);
      setNotice({ historyReset: false, sameAsPrevious: false });
      setStatus("ready");
      return;
    }
    applyPick(candidates);
  }, [candidates, fixedId, scope, applyPick]);

  const repick = useCallback(() => {
    if (candidates) applyPick(candidates);
  }, [candidates, applyPick]);

  return { status, current, ...notice, repick };
}
