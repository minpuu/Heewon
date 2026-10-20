"use client";

import { useEffect, useState } from "react";
import type { Candidate, Coordinates } from "@/domain/types";
import { getNearbyRestaurants } from "@/services/getNearbyRestaurants";

export interface NearbyState {
  candidates: Candidate[] | null;
  error: boolean;
}

/** 출발지가 바뀔 때마다 주변 식당 후보를 다시 가져온다. */
export function useNearbyCandidates(origin: Coordinates | null): NearbyState {
  const [state, setState] = useState<NearbyState>({ candidates: null, error: false });
  const originKey = origin ? `${origin.latitude},${origin.longitude}` : null;

  useEffect(() => {
    if (!origin) return;
    let cancelled = false;
    setState({ candidates: null, error: false });

    getNearbyRestaurants(origin)
      .then((candidates) => {
        if (!cancelled) setState({ candidates, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ candidates: null, error: true });
      });

    return () => {
      cancelled = true;
    };
    // origin 객체 대신 좌표 문자열로 비교한다.
  }, [originKey]);

  return state;
}
