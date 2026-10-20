import { CATEGORY_LABEL, CATEGORY_ORDER } from "@/domain/filter";
import type { FoodCategory } from "@/domain/types";

export type CategoryFilter = "all" | FoodCategory;

interface CategoryTabsProps {
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
  counts: { all: number } & Record<FoodCategory, number>;
}

export function CategoryTabs({ value, onChange, counts }: CategoryTabsProps) {
  const tabs: { id: CategoryFilter; label: string; count: number }[] = [
    { id: "all", label: "전체", count: counts.all },
    ...CATEGORY_ORDER.map((id) => ({ id, label: CATEGORY_LABEL[id], count: counts[id] })),
  ];

  return (
    <div role="tablist" aria-label="음식 카테고리" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors ${
              selected ? "bg-ink text-white" : "border border-border bg-surface text-ink"
            }`}
          >
            {tab.label}
            <span className={selected ? "text-white/70" : "text-muted"}>{tab.count}</span>
          </button>
        );
      })}
    </div>
  );
}
