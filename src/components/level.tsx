import type { GoalResult, Rated } from "../domain/scoring";
import { GOAL_LABEL, GOAL_SHORT, GOALS, LEVEL_LABEL, type Goal } from "../domain/types";
import { cn } from "./ui";

export const LEVEL_BG: Record<Rated, string> = { 1: "bg-lvl-1", 2: "bg-lvl-2", 3: "bg-lvl-3" };

/** Three bars filled up to the level; color lives only here. */
export function LevelBars({ level, className }: { level: Rated | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-[2px]", className)} aria-hidden>
      {([1, 2, 3] as const).map((step) => (
        <span
          key={step}
          className={cn(
            "w-[4px] rounded-[1px]",
            step === 1 ? "h-[6px]" : step === 2 ? "h-[9px]" : "h-[12px]",
            level && step <= level ? LEVEL_BG[level] : "bg-line",
          )}
        />
      ))}
    </span>
  );
}

/** Level as bars plus the word in ink. `compact` renders bars only. */
export function LevelMark({ level, compact, className }: { level: Rated | null; compact?: boolean; className?: string }) {
  const label = level ? LEVEL_LABEL[level] : "offen";
  if (compact) {
    return (
      <span title={label} className={cn("inline-flex", className)}>
        <LevelBars level={level} />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap", level ? "text-ink" : "text-muted", className)}>
      <LevelBars level={level} />
      {label}
    </span>
  );
}

/** V / I / A in one line for lists: letter + bars. */
export function TriadMarks({ results }: { results: Record<Goal, GoalResult> }) {
  return (
    <span className="inline-flex items-center gap-3">
      {GOALS.map((g) => {
        const r = results[g];
        return (
          <span
            key={g}
            className="inline-flex items-center gap-1.5"
            title={`${GOAL_LABEL[g]}: ${r.effective ? LEVEL_LABEL[r.effective] : "offen"}${r.complete ? "" : " (unvollständig)"}`}
          >
            <span className="text-[12px] font-medium text-muted" aria-hidden>
              {GOAL_SHORT[g]}
            </span>
            <LevelBars level={r.effective} />
            <span className="sr-only">
              {GOAL_LABEL[g]}: {r.effective ? LEVEL_LABEL[r.effective] : "offen"}
              {r.complete ? "" : " (unvollständig)"}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Aggregated result per goal: columns (wide) or rows (sidebar). */
export function ResultSummary({ results, layout = "columns" }: { results: Record<Goal, GoalResult>; layout?: "columns" | "rows" }) {
  return (
    <div>
      <dl className={cn(layout === "columns" ? "grid grid-cols-3 divide-x divide-line" : "divide-y divide-line")}>
        {GOALS.map((g, i) => {
          const r = results[g];
          const note = r.override ? "übersteuert" : r.complete ? "vollständig" : `${r.answered} von ${r.total} bewertet`;
          return layout === "columns" ? (
            <div key={g} className={cn("min-w-0 py-1", i === 0 ? "pr-2 sm:pr-3" : "px-2 sm:px-3")}>
              <dt className="truncate text-[12.5px] text-muted">{GOAL_LABEL[g]}</dt>
              <dd className="mt-1.5 flex items-center gap-2">
                <LevelBars level={r.effective} />
                <span className={cn("font-display text-[14px] leading-none font-semibold whitespace-nowrap min-[360px]:text-[15px] sm:text-[19px]", !r.effective && "text-muted")}>
                  {r.effective ? LEVEL_LABEL[r.effective] : "offen"}
                </span>
              </dd>
              <dd className="mt-1.5 truncate text-[12px] text-muted tabular">{note}</dd>
            </div>
          ) : (
            <div key={g} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-[13px] text-muted">{GOAL_LABEL[g]}</dt>
              <dd className="flex items-center gap-2 text-right">
                <span className="text-[12px] text-muted">{r.override ? "übersteuert" : r.complete ? "" : `${r.answered}/${r.total}`}</span>
                <LevelMark level={r.effective} />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
