"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Coordinates } from "@/domain/types";
import { PRESET_LOCATIONS } from "@/data/presetLocations";
import { readJson, writeJson } from "@/lib/storage";

export type LocationStatus = "locating" | "ready" | "denied" | "unsupported" | "error";

export interface UserLocation {
  label: string;
  coords: Coordinates;
  source: "gps" | "preset";
}

interface LocationContextValue {
  status: LocationStatus;
  location: UserLocation | null;
  /** 브라우저 위치 권한을 요청하고 현재 위치를 사용한다. */
  useCurrentLocation: () => void;
  /** 테스트용 기준 위치를 선택한다. 다음 방문에도 유지한다. */
  choosePreset: (id: string) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

const PRESET_KEY = "location-preset";
const GEOLOCATION_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 };

function findPreset(id: string | null | undefined) {
  return PRESET_LOCATIONS.find((preset) => preset.id === id) ?? null;
}

function presetToLocation(id: string): UserLocation | null {
  const preset = findPreset(id);
  if (!preset) return null;
  return {
    label: preset.label,
    coords: { latitude: preset.latitude, longitude: preset.longitude },
    source: "preset",
  };
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("locating");
  const [location, setLocation] = useState<UserLocation | null>(null);

  const requestGps = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          label: "현재 위치",
          coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
          source: "gps",
        });
        setStatus("ready");
      },
      (error) => {
        setLocation(null);
        // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
        setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      GEOLOCATION_OPTIONS,
    );
  }, []);

  const useCurrentLocation = useCallback(() => {
    writeJson("local", PRESET_KEY, null);
    requestGps();
  }, [requestGps]);

  const choosePreset = useCallback((id: string) => {
    const next = presetToLocation(id);
    if (!next) return;
    writeJson("local", PRESET_KEY, id);
    setLocation(next);
    setStatus("ready");
  }, []);

  useEffect(() => {
    const savedPreset = readJson<string>("local", PRESET_KEY);
    const preset = presetToLocation(savedPreset ?? "");
    if (preset) {
      setLocation(preset);
      setStatus("ready");
      return;
    }
    requestGps();
  }, [requestGps]);

  const value = useMemo(
    () => ({ status, location, useCurrentLocation, choosePreset }),
    [status, location, useCurrentLocation, choosePreset],
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used within LocationProvider");
  return context;
}
