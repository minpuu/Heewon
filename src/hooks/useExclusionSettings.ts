"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_EXCLUSIONS, type ExclusionSettings } from "@/domain/exclusions";
import { readJson, writeJson } from "@/lib/storage";

const KEY = "exclusion-settings";

/**
 * 제외 조건을 브라우저에 저장한다.
 * 저장된 값은 마운트 후에 읽어 SSR 하이드레이션 불일치를 피한다.
 */
export function useExclusionSettings() {
  const [settings, setSettings] = useState<ExclusionSettings>(DEFAULT_EXCLUSIONS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = readJson<Partial<ExclusionSettings>>("local", KEY);
    if (stored) {
      setSettings({
        excludeRaw: stored.excludeRaw === true,
        excludeHighWaiting: stored.excludeHighWaiting === true,
      });
    }
    setLoaded(true);
  }, []);

  const update = useCallback((next: ExclusionSettings) => {
    setSettings(next);
    writeJson("local", KEY, next);
  }, []);

  return { settings, update, loaded };
}
