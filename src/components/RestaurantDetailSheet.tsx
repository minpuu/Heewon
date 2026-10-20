"use client";

import { buildWalkingDirectionsUrl } from "@/domain/mapLink";
import type { Candidate } from "@/domain/types";
import { formatCategory, formatOpenStatus, formatWalk } from "@/lib/format";
import { BottomSheet } from "./BottomSheet";

interface RestaurantDetailSheetProps {
  candidate: Candidate | null;
  onClose: () => void;
  onDecide: (id: string) => void;
}

export function RestaurantDetailSheet({ candidate, onClose, onDecide }: RestaurantDetailSheetProps) {
  const restaurant = candidate?.restaurant;
  const openLabel = restaurant ? formatOpenStatus(restaurant.openStatus) : null;

  return (
    <BottomSheet open={candidate !== null} title={restaurant?.name ?? "식당"} onClose={onClose}>
      {candidate && restaurant && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-ink break-keep">{restaurant.name}</p>
            <p className="mt-1 text-sm text-ink/80">{formatCategory(restaurant)}</p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-background px-4 py-4 text-sm">
            <dt className="text-muted">주소</dt>
            <dd className="text-ink">{restaurant.address}</dd>
            <dt className="text-muted">도보</dt>
            <dd className="text-ink">{formatWalk(candidate.walk)}</dd>
            {openLabel && (
              <>
                <dt className="text-muted">영업</dt>
                <dd className="text-success">{openLabel}</dd>
              </>
            )}
            {restaurant.representativeMenu && (
              <>
                <dt className="text-muted">대표 메뉴</dt>
                <dd className="text-ink">{restaurant.representativeMenu}</dd>
              </>
            )}
          </dl>

          <a
            href={buildWalkingDirectionsUrl(restaurant)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 items-center justify-center rounded-2xl border border-border bg-surface font-semibold text-ink active:bg-background"
          >
            길찾기
          </a>
          <button
            type="button"
            onClick={() => onDecide(restaurant.id)}
            className="h-14 rounded-2xl bg-accent font-bold text-white shadow-lg shadow-accent/30 active:scale-[0.99]"
          >
            여기로 결정
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
