import { WALK_MINUTE_OPTIONS, type WalkMinutes } from "@/config/app";

interface DistanceSelectorProps {
  value: WalkMinutes;
  onChange: (value: WalkMinutes) => void;
}

export function DistanceSelector({ value, onChange }: DistanceSelectorProps) {
  return (
    <div role="radiogroup" aria-label="도보 거리" className="grid grid-cols-3 gap-3">
      {WALK_MINUTE_OPTIONS.map((minutes) => {
        const selected = minutes === value;
        return (
          <button
            key={minutes}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(minutes)}
            className={`h-16 rounded-2xl text-xl font-bold transition-colors duration-150 active:scale-[0.98] ${
              selected
                ? "bg-accent text-white shadow-md shadow-accent/25"
                : "border border-border bg-surface text-ink"
            }`}
          >
            {minutes}분
          </button>
        );
      })}
    </div>
  );
}
