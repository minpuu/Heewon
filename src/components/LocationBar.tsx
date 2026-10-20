import type { LocationStatus, UserLocation } from "@/hooks/useLocation";

interface LocationBarProps {
  status: LocationStatus;
  location: UserLocation | null;
  onChange: () => void;
}

export function LocationBar({ status, location, onChange }: LocationBarProps) {
  let text: string;
  if (location) text = location.label;
  else if (status === "locating") text = "위치 확인 중…";
  else text = "위치를 확인할 수 없어요";

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true">📍</span>
        <span className="truncate text-[15px] font-semibold text-ink">{text}</span>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-muted active:bg-border/60"
      >
        변경
      </button>
    </div>
  );
}
