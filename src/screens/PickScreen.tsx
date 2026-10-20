"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import type { WalkMinutes } from "@/config/app";
import { buildWalkingDirectionsUrl } from "@/domain/mapLink";
import { filterRestaurants } from "@/domain/filter";
import { exclusionKey } from "@/domain/exclusions";
import { useExclusionSettings } from "@/hooks/useExclusionSettings";
import { useLocation } from "@/hooks/useLocation";
import { useNearbyCandidates } from "@/hooks/useNearbyCandidates";
import { usePickSession } from "@/hooks/usePickSession";
import { formatCategory, formatOpenStatus, formatWalk } from "@/lib/format";
import { StatePanel } from "@/components/StatePanel";

interface PickScreenProps {
  walkMinutes: WalkMinutes;
  fixedId?: string;
}

export function PickScreen({ walkMinutes, fixedId }: PickScreenProps) {
  const { status, location } = useLocation();
  const { settings, loaded } = useExclusionSettings();
  const nearby = useNearbyCandidates(location?.coords ?? null);

  const filtered = useMemo(() => {
    if (!nearby.candidates || !loaded) return null;
    return filterRestaurants(nearby.candidates, { ...settings, maxWalkMinutes: walkMinutes });
  }, [nearby.candidates, loaded, settings, walkMinutes]);

  const scope = `${walkMinutes}|${exclusionKey(settings)}`;
  const pick = usePickSession({ candidates: filtered, scope, fixedId });

  const backLink = (
    <Link
      href="/"
      aria-label="처음으로"
      className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-ink active:bg-border/60"
    >
      ←
    </Link>
  );

  if (!location && status === "locating") {
    return (
      <Shell back={backLink}>
        <p className="text-center text-sm text-muted" role="status">
          위치를 확인하는 중…
        </p>
      </Shell>
    );
  }

  if (!location) {
    return (
      <Shell back={backLink}>
        <StatePanel title="위치를 확인해야 해요" description="처음 화면에서 위치를 먼저 설정해 주세요.">
          <Link href="/" className="flex h-12 items-center justify-center rounded-2xl bg-ink font-semibold text-white">
            처음으로
          </Link>
        </StatePanel>
      </Shell>
    );
  }

  if (nearby.error) {
    return (
      <Shell back={backLink}>
        <StatePanel tone="warning" title="식당을 불러오지 못했어요" description="잠시 후 다시 시도해 주세요." />
      </Shell>
    );
  }

  if (pick.status === "loading" || filtered === null) {
    return (
      <Shell back={backLink}>
        <p className="text-center text-sm text-muted" role="status">
          주변 식당을 찾는 중…
        </p>
      </Shell>
    );
  }

  if (pick.status === "empty" || !pick.current) {
    return (
      <Shell back={backLink}>
        <StatePanel
          title="조건에 맞는 식당이 없어요"
          description={`도보 ${walkMinutes}분 이내, 현재 제외 조건을 모두 통과한 식당이 없어요. 거리를 바꾸거나 제외 조건을 줄여 보세요.`}
        >
          <Link href="/" className="flex h-12 items-center justify-center rounded-2xl bg-ink font-semibold text-white">
            거리 다시 선택하기
          </Link>
        </StatePanel>
      </Shell>
    );
  }

  const { restaurant, walk } = pick.current;
  const openLabel = formatOpenStatus(restaurant.openStatus);

  return (
    <Shell back={backLink}>
      <div className="flex flex-1 flex-col justify-center pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-strong">오늘은 여기</span>
          {restaurant.isSample && (
            <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">샘플</span>
          )}
        </div>

        <h1 className="mt-5 text-[42px] leading-[1.1] font-extrabold tracking-tight break-keep text-ink">
          {restaurant.name}
        </h1>

        <p className="mt-4 text-lg font-medium text-ink/80">{formatCategory(restaurant)}</p>
        {restaurant.representativeMenu && (
          <p className="mt-1 text-[15px] text-muted">대표 메뉴 · {restaurant.representativeMenu}</p>
        )}

        <div className="mt-6 flex items-center gap-3 text-sm font-semibold text-ink">
          <span>{formatWalk(walk)}</span>
          {openLabel && (
            <>
              <span className="text-border" aria-hidden="true">|</span>
              <span className="text-success">{openLabel}</span>
            </>
          )}
        </div>

        {pick.sameAsPrevious && (
          <p className="mt-6 rounded-2xl bg-background px-4 py-3 text-sm text-muted">
            조건에 맞는 식당이 1곳뿐이라 같은 식당이 다시 나왔어요.
          </p>
        )}
        {pick.historyReset && !pick.sameAsPrevious && (
          <p className="mt-6 rounded-2xl bg-background px-4 py-3 text-sm text-muted">
            모든 후보를 한 번씩 보여드려서 처음부터 다시 골랐어요.
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[440px] bg-background px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <a
          href={buildWalkingDirectionsUrl(restaurant)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-16 w-full items-center justify-center rounded-2xl bg-accent text-lg font-bold text-white shadow-lg shadow-accent/30 active:scale-[0.99]"
        >
          길찾기
        </a>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={pick.repick}
            className="h-14 rounded-2xl border border-border bg-surface font-semibold text-ink active:bg-background"
          >
            다시 뽑기
          </button>
          <Link
            href={`/list?walk=${walkMinutes}`}
            className="flex h-14 items-center justify-center rounded-2xl border border-border bg-surface font-semibold text-ink active:bg-background"
          >
            목록 보기
          </Link>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ back, children }: { back: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-[calc(env(safe-area-inset-bottom)+136px)]">
      <header className="-ml-2">{back}</header>
      <main className="flex flex-1 flex-col pt-4">{children}</main>
    </div>
  );
}
