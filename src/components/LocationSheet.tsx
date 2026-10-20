"use client";

import { PRESET_LOCATIONS } from "@/data/presetLocations";
import type { UserLocation } from "@/hooks/useLocation";
import { BottomSheet } from "./BottomSheet";

interface LocationSheetProps {
  open: boolean;
  onClose: () => void;
  location: UserLocation | null;
  onUseCurrent: () => void;
  onChoosePreset: (id: string) => void;
}

export function LocationSheet({
  open,
  onClose,
  location,
  onUseCurrent,
  onChoosePreset,
}: LocationSheetProps) {
  const selectedPresetId =
    location?.source === "preset"
      ? PRESET_LOCATIONS.find((preset) => preset.label === location.label)?.id
      : undefined;

  return (
    <BottomSheet open={open} title="위치 변경" onClose={onClose}>
      <button
        type="button"
        onClick={() => {
          onUseCurrent();
          onClose();
        }}
        className="mb-3 flex h-14 w-full items-center justify-between rounded-2xl bg-accent-soft px-4 text-left font-semibold text-accent-strong active:opacity-80"
      >
        <span>현재 위치 사용</span>
        <span aria-hidden="true">{location?.source === "gps" ? "✓" : "›"}</span>
      </button>

      <p className="mb-2 px-1 text-xs text-muted">테스트용 기준 위치</p>
      <ul className="flex flex-col gap-2">
        {PRESET_LOCATIONS.map((preset) => {
          const selected = preset.id === selectedPresetId;
          return (
            <li key={preset.id}>
              <button
                type="button"
                onClick={() => {
                  onChoosePreset(preset.id);
                  onClose();
                }}
                aria-pressed={selected}
                className={`flex h-14 w-full items-center justify-between rounded-2xl border px-4 text-left font-medium active:opacity-80 ${
                  selected ? "border-accent text-ink" : "border-border text-ink"
                }`}
              >
                <span>{preset.label}</span>
                {selected && <span aria-hidden="true" className="text-accent">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
