"use client";

import type { ExclusionSettings } from "@/domain/exclusions";
import { BottomSheet } from "./BottomSheet";
import { Switch } from "./Switch";

interface ExclusionSheetProps {
  open: boolean;
  onClose: () => void;
  settings: ExclusionSettings;
  onChange: (next: ExclusionSettings) => void;
}

export function ExclusionSheet({ open, onClose, settings, onChange }: ExclusionSheetProps) {
  return (
    <BottomSheet open={open} title="제외 조건" onClose={onClose}>
      <ul className="flex flex-col gap-3">
        <li className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-4">
          <div>
            <p className="font-semibold text-ink">날것 중심 식당 제외</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">회·육회처럼 날것이 주력인 식당을 뺍니다.</p>
          </div>
          <Switch
            label="날것 중심 식당 제외"
            checked={settings.excludeRaw}
            onChange={(excludeRaw) => onChange({ ...settings, excludeRaw })}
          />
        </li>
        <li className="flex items-center justify-between gap-4 rounded-2xl border border-border px-4 py-4">
          <div>
            <p className="font-semibold text-ink">대기 잦은 식당 제외</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">대기가 잦다고 확인된 식당을 뺍니다. 실시간 대기 정보가 아니에요.</p>
          </div>
          <Switch
            label="대기 잦은 식당 제외"
            checked={settings.excludeHighWaiting}
            onChange={(excludeHighWaiting) => onChange({ ...settings, excludeHighWaiting })}
          />
        </li>
      </ul>
      <p className="mt-4 rounded-2xl bg-background px-4 py-3 text-xs leading-relaxed text-muted">
        조건을 켜면 정보가 확인된 식당만 대상으로 해요. 정보가 없는 식당은 안전하다고 보지 않아 함께 빠집니다.
      </p>
    </BottomSheet>
  );
}
