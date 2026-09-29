import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import type { GoalResult, Rated } from "../domain/scoring";
import { GOAL_LABEL, GOAL_SHORT, GOALS, LEVEL_LABEL, type Goal } from "../domain/types";
import type { IntegrityState } from "../domain/versioning";
import { cn } from "./ui";

export const LEVEL_BG: Record<Rated, string> = { 1: "bg-lvl-1", 2: "bg-lvl-2", 3: "bg-lvl-3" };
export const LEVEL_TEXT: Record<Rated, string> = { 1: "text-emerald-700", 2: "text-amber-700", 3: "text-red-700" };
const LEVEL_SOFT: Record<Rated, string> = {
  1: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  2: "bg-amber-50 text-amber-800 ring-amber-200",
  3: "bg-red-50 text-red-800 ring-red-200",
};

export function LevelPill({ level, className }: { level: Rated | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-[4px] px-1.5 text-[11.5px] font-semibold whitespace-nowrap ring-1 ring-inset",
        level ? LEVEL_SOFT[level] : "bg-surface text-muted ring-line",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", level ? LEVEL_BG[level] : "bg-lvl-open")} />
      {level ? LEVEL_LABEL[level] : "offen"}
    </span>
  );
}

/** Three-segment gauge: how far up the scale a level reaches. */
export function LevelGauge({ level, className }: { level: Rated | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-[2px]", className)} aria-hidden>
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn(
            "w-[4px] rounded-[1px]",
            step === 1 ? "h-[6px]" : step === 2 ? "h-[9px]" : "h-[12px]",
            level && step <= level ? LEVEL_BG[level] : "bg-lvl-open",
          )}
        />
      ))}
    </span>
  );
}

/** Compact V/I/A strip for lists. */
export function TriadChips({ results }: { results: Record<Goal, GoalResult> }) {
  return (
    <span className="inline-flex gap-1">
      {GOALS.map((g) => {
        const r = results[g];
        return (
          <span
            key={g}
            title={`${GOAL_LABEL[g]}: ${r.effective ? LEVEL_LABEL[r.effective] : "offen"}${r.complete ? "" : " (unvollständig)"}`}
            className={cn(
              "inline-flex h-6 w-7 items-center justify-center rounded-[4px] text-[11.5px] font-bold",
              r.effective ? cn(LEVEL_BG[r.effective], "text-white") : "bg-surface text-muted ring-1 ring-line ring-inset",
              !r.complete && r.effective && "opacity-60",
            )}
          >
            {GOAL_SHORT[g]}
          </span>
        );
      })}
    </span>
  );
}

/**
 * The seal: live V/I/A result. Once a version is approved it carries the
 * SHA-256 fingerprint and the verification state.
 */
export function Seal({
  results,
  integrity,
  hash,
  compact,
}: {
  results: Record<Goal, GoalResult>;
  integrity: IntegrityState;
  hash: string | null;
  compact?: boolean;
}) {
  const sealed = integrity !== "unsealed";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-paper",
        integrity === "valid" && "border-primary-950 shadow-[0_0_0_3px_var(--color-primary-100)]",
        integrity === "tampered" && "border-red-500 shadow-[0_0_0_3px_var(--color-red-100)]",
        !sealed && "border-line",
      )}
    >
      <div className={cn("grid grid-cols-3 divide-x divide-line", compact ? "h-24" : "h-36")}>
        {GOALS.map((g) => {
          const r = results[g];
          const level = r.effective;
          return (
            <div key={g} className="relative flex min-w-0 flex-col justify-between px-3 pt-2.5 pb-2.5">
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out",
                  level ? LEVEL_BG[level] : "bg-transparent",
                )}
                style={{ height: level ? `${(level / 3) * 100}%` : "0%", opacity: r.complete ? 0.16 : 0.08 }}
              />
              <span className="relative truncate text-[11px] font-medium text-muted">{GOAL_LABEL[g]}</span>
              <div className="relative">
                <div
                  className={cn(
                    "font-display leading-none font-bold whitespace-nowrap",
                    compact ? "text-[16px]" : "text-[17px]",
                    level ? LEVEL_TEXT[level] : "text-muted/60",
                  )}
                >
                  {level ? LEVEL_LABEL[level] : "offen"}
                </div>
                <div className="mt-1 truncate text-[11px] text-muted tabular">
                  {r.override ? "übersteuert" : r.complete ? "vollständig" : `${r.answered}/${r.total} Szenarien`}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div
        className={cn(
          "flex items-center gap-2 border-t px-3 py-1.5 text-[11.5px]",
          integrity === "valid" && "border-primary-950 bg-primary-950 text-white",
          integrity === "tampered" && "border-red-500 bg-red-600 text-white",
          !sealed && "border-line bg-surface text-muted",
        )}
      >
        {integrity === "valid" && <ShieldCheck className="size-3.5 shrink-0" />}
        {integrity === "tampered" && <ShieldAlert className="size-3.5 shrink-0" />}
        {!sealed && <ShieldQuestion className="size-3.5 shrink-0" />}
        <span className="min-w-0 truncate">
          {integrity === "valid" && <>Versiegelt · geprüft · SHA-256 </>}
          {integrity === "tampered" && <>Siegel verletzt · Inhalt verändert · SHA-256 </>}
          {!sealed && <>Nicht versiegelt · Siegel wird bei Freigabe gesetzt</>}
          {hash && <span className="font-mono tracking-tight opacity-80">{hash.slice(0, 8)}…{hash.slice(-6)}</span>}
        </span>
      </div>
    </div>
  );
}
