"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { WalkMinutes } from "@/config/app";
import { exclusionKey } from "@/domain/exclusions";
import { filterRestaurants, groupRestaurantsByCategory } from "@/domain/filter";
import type { Candidate } from "@/domain/types";
import { useExclusionSettings } from "@/hooks/useExclusionSettings";
import { useLocation } from "@/hooks/useLocation";
import { useNearbyCandidates } from "@/hooks/useNearbyCandidates";
import { formatCategory, formatOpenStatus, formatWalk } from "@/lib/format";
import { CategoryTabs, type CategoryFilter } from "@/components/CategoryTabs";
import { RestaurantDetailSheet } from "@/components/RestaurantDetailSheet";
import { StatePanel } from "@/components/StatePanel";

interface ListScreenProps {
  walkMinutes: WalkMinutes;
}

export function ListScreen({ walkMinutes }: ListScreenProps) {
  const router = useRouter();
  const { status, location } = useLocation();
  const { settings, update, loaded } = useExclusionSettings();
  const anyExclusion = settings.excludeRaw || settings.excludeHighWaiting;
  const nearby = useNearbyCandidates(location?.coords ?? null);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selected, setSelected] = useState<Candidate | null>(null);

  // 거리·제외 조건은 처음 선택한 값을 그대로 쓰고, 카테고리만 바꿔 본다.
  const filtered = useMemo(() => {
    if (!nearby.candidates || !loaded) return null;
    return filterRestaurants(nearby.candidates, { ...settings, maxWalkMinutes: walkMinutes });
  }, [nearby.candidates, loaded, settings, walkMinutes]);

  const groups = useMemo(() => (filtered ? groupRestaurantsByCategory(filtered) : null), [filtered]);
  const visible = groups ? (category === "all" ? groups.all : groups.byCategory[category]) : [];

  const backToPick = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  const decide = (id: string) => {
    setSelected(null);
    router.push(`/pick?walk=${walkMinutes}&id=${encodeURIComponent(id)}`);
  };

  const header = (
    <header className="flex items-center gap-2 -ml-2">
      <button
        type="button"
        onClick={backToPick}
        aria-label="뒤로"
        className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-ink active:bg-border/60"
      >
        ←
      </button>
      <div>
        <p className="text-sm text-muted">{location?.label ?? "위치 확인 필요"}</p>
        <h1 className="text-xl font-extrabold text-ink">도보 {walkMinutes}분 이내</h1>
      </div>
    </header>
  );

  const shell = (children: ReactNode) => (
    <div className="flex min-h-dvh flex-col gap-5 px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+32px)]">
      {header}
      {children}
    </div>
  );

  if (!location && status !== "locating") {
    return shell(
      <StatePanel title="위치를 확인해야 해요" description="처음 화면에서 위치를 먼저 설정해 주세요.">
        <Link href="/" className="flex h-12 items-center justify-center rounded-2xl bg-ink font-semibold text-white">
          처음으로
        </Link>
      </StatePanel>,
    );
  }

  if (nearby.error) {
    return shell(<StatePanel tone="warning" title="식당을 불러오지 못했어요" description="잠시 후 다시 시도해 주세요." />);
  }

  if (!groups || (status === "locating" && !location)) {
    return shell(
      <p className="text-center text-sm text-muted" role="status">
        주변 식당을 찾는 중…
      </p>,
    );
  }

  const totalEmpty = groups.all.length === 0;

  return shell(
    <>
      <p className="-mt-2 text-xs text-muted">도보 시간은 직선거리 기준 추정치예요.</p>

      <CategoryTabs value={category} onChange={setCategory} counts={countsOf(groups)} />

      {totalEmpty ? (
        <StatePanel
          title="조건에 맞는 식당이 없어요"
          description={
            anyExclusion
              ? `도보 ${walkMinutes}분 이내에서 제외 조건을 통과한 식당이 없어요. 확인되지 않은 정보는 제외 대상이라 결과가 줄 수 있어요.`
              : `도보 ${walkMinutes}분 이내에 식당이 없어요. 거리를 바꿔 보세요.`
          }
        >
          {anyExclusion && (
            <button
              type="button"
              onClick={() => update({ excludeRaw: false, excludeHighWaiting: false })}
              className="flex h-12 items-center justify-center rounded-2xl border border-border bg-surface font-semibold text-ink active:bg-background"
            >
              제외 조건 끄고 다시 보기
            </button>
          )}
          <Link href="/" className="flex h-12 items-center justify-center rounded-2xl bg-ink font-semibold text-white">
            거리 다시 선택하기
          </Link>
        </StatePanel>
      ) : visible.length === 0 ? (
        <StatePanel title="이 카테고리에는 식당이 없어요" description="다른 카테고리를 골라 보세요." />
      ) : (
        <ul className="overflow-hidden rounded-3xl border border-border bg-surface divide-y divide-border">
          {visible.map((candidate) => {
            const { restaurant, walk } = candidate;
            const openLabel = formatOpenStatus(restaurant.openStatus);
            return (
              <li key={restaurant.id}>
                <button
                  type="button"
                  onClick={() => setSelected(candidate)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left active:bg-background"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] font-bold text-ink">
                      {restaurant.name}
                    </span>
                    <span className="mt-1 block truncate text-sm text-muted">
                      {formatCategory(restaurant)}
                      {restaurant.representativeMenu ? ` · ${restaurant.representativeMenu}` : ""}
                    </span>
                    <span className="mt-1 block text-xs font-medium text-ink/70">
                      {formatWalk(walk)}
                      {openLabel && <span className="text-success"> · {openLabel}</span>}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-xl text-muted">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {groups.all.some((c) => c.restaurant.isSample) && (
        <p className="text-center text-[11px] text-muted">샘플 데이터 · 실제 영업 정보가 아니에요</p>
      )}

      <RestaurantDetailSheet candidate={selected} onClose={() => setSelected(null)} onDecide={decide} />
    </>,
  );
}

function countsOf(groups: ReturnType<typeof groupRestaurantsByCategory>) {
  return {
    all: groups.all.length,
    korean: groups.byCategory.korean.length,
    chinese: groups.byCategory.chinese.length,
    japanese: groups.byCategory.japanese.length,
    western: groups.byCategory.western.length,
    other: groups.byCategory.other.length,
  };
}
