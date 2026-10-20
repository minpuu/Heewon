import type { ReactNode } from "react";

interface StatePanelProps {
  title: string;
  description?: string;
  tone?: "neutral" | "warning";
  children?: ReactNode;
}

/** 로딩·오류·빈 결과·위치 권한 안내에 공통으로 쓰는 패널. */
export function StatePanel({ title, description, tone = "neutral", children }: StatePanelProps) {
  return (
    <div
      role={tone === "warning" ? "alert" : "status"}
      className={`rounded-3xl px-5 py-6 text-center ${
        tone === "warning" ? "bg-warning-soft" : "bg-surface border border-border"
      }`}
    >
      <p className="text-lg font-bold text-ink">{title}</p>
      {description && <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>}
      {children && <div className="mt-5 flex flex-col gap-2">{children}</div>}
    </div>
  );
}
