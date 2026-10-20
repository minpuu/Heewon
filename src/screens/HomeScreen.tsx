"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_WALK_MINUTES, type WalkMinutes } from "@/config/app";
import { DEFAULT_EXCLUSIONS } from "@/domain/exclusions";
import { useExclusionSettings } from "@/hooks/useExclusionSettings";
import { useLocation } from "@/hooks/useLocation";
import { BottomSheet } from "@/components/BottomSheet";
import { DistanceSelector } from "@/components/DistanceSelector";
import { ExclusionSheet } from "@/components/ExclusionSheet";
import { LocationBar } from "@/components/LocationBar";
import { LocationSheet } from "@/components/LocationSheet";
import { StatePanel } from "@/components/StatePanel";

export function HomeScreen() {
  const router = useRouter();
  const { status, location, useCurrentLocation, choosePreset } = useLocation();
  const { settings, update, loaded } = useExclusionSettings();
  const [walkMinutes, setWalkMinutes] = useState<WalkMinutes>(DEFAULT_WALK_MINUTES);
  const [locationOpen, setLocationOpen] = useState(false);
  const [exclusionOpen, setExclusionOpen] = useState(false);
  const [samplePolicyOpen, setSamplePolicyOpen] = useState(false);

  const canDecide = location !== null;
  const activeExclusions = [settings.excludeRaw && "날것", settings.excludeHighWaiting && "대기"].filter(Boolean);
  const exclusionSummary = activeExclusions.length > 0 ? `${activeExclusions.join(" · ")} 제외` : "모두 꺼짐";

  const decide = () => {
    if (!canDecide) return;
    const params = new URLSearchParams({ walk: String(walkMinutes) });
    router.push(`/pick?${params.toString()}`);
  };

  return (
    <div className="flex min-h-dvh flex-col px-5 pt-[calc(env(safe-area-inset-top)+20px)] pb-[calc(env(safe-area-inset-bottom)+124px)]">
      <header>
        <LocationBar status={status} location={location} onChange={() => setLocationOpen(true)} />
      </header>

      <main className="flex flex-1 flex-col pt-10">
        {!canDecide && status !== "locating" && (
          <div className="mb-8">
            <StatePanel
              tone="warning"
              title="위치가 있어야 식당을 고를 수 있어요"
              description={locationGuidance(status)}
            >
              <button
                type="button"
                onClick={useCurrentLocation}
                className="h-12 rounded-2xl bg-ink font-semibold text-white active:opacity-80"
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={() => setLocationOpen(true)}
                className="h-12 rounded-2xl border border-border bg-surface font-semibold text-ink active:opacity-80"
              >
                테스트 기준 위치 선택
              </button>
            </StatePanel>
          </div>
        )}

        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight text-ink">
          어디까지 걸을까요?
        </h1>

        <section className="mt-6">
          <DistanceSelector value={walkMinutes} onChange={setWalkMinutes} />
        </section>

        <section className="mt-6">
          <button
            type="button"
            onClick={() => setExclusionOpen(true)}
            className="flex h-16 w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 text-left active:bg-background"
          >
            <span>
              <span className="block text-[15px] font-semibold text-ink">제외 조건 설정</span>
              <span className="mt-0.5 block text-xs text-muted">
                {loaded ? exclusionSummary : "불러오는 중"}
              </span>
            </span>
            <span aria-hidden="true" className="text-xl text-muted">›</span>
          </button>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[440px] bg-linear-to-t from-background via-background to-background/0 px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+20px)]">
        <p className="mb-3 text-center text-[11px] text-muted">
          <button type="button" onClick={() => setSamplePolicyOpen(true)} className="underline underline-offset-2">
            도보 시간 안내
          </button>
        </p>
        <button
          type="button"
          onClick={decide}
          disabled={!canDecide}
          className="h-16 w-full rounded-2xl bg-accent text-lg font-bold text-white shadow-lg shadow-accent/30 transition active:scale-[0.99] disabled:bg-border disabled:text-muted disabled:shadow-none"
        >
          아무거나 골라줘
        </button>
      </div>

      <LocationSheet
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        location={location}
        onUseCurrent={useCurrentLocation}
        onChoosePreset={choosePreset}
      />

      <ExclusionSheet
        open={exclusionOpen}
        onClose={() => setExclusionOpen(false)}
        settings={loaded ? settings : DEFAULT_EXCLUSIONS}
        onChange={update}
      />

      <BottomSheet open={samplePolicyOpen} title="도보 시간 안내" onClose={() => setSamplePolicyOpen(false)}>
        <p className="text-sm leading-relaxed text-ink">
          현재 도보 시간은 좌표 기반 직선거리로 추정한 값이라, 실제 보행 경로와 차이가 있을 수 있어요.
          거리 조건이 정확히 지켜진다고 보장하지 않습니다.
        </p>
      </BottomSheet>
    </div>
  );
}

function locationGuidance(status: string): string {
  switch (status) {
    case "denied":
      return "브라우저의 위치 권한을 허용하면 현재 위치 기준으로 찾아요.";
    case "unsupported":
      return "이 브라우저에서는 위치 정보를 쓸 수 없어요. 테스트 기준 위치를 선택해 주세요.";
    default:
      return "위치를 가져오지 못했어요. 다시 시도하거나 테스트 기준 위치를 선택해 주세요.";
  }
}
