import { CATALOG, type ScenarioDef } from "../../domain/catalog";
import type { Goal, ScenarioAnswer } from "../../domain/types";

/** Ja/Nein cell value, or null for an empty cell. */
export type YesNo = "Ja" | "Nein" | null;

/** Answer cells (column E) of one scenario block: gate first, then options/follow-up. */
export interface BlockCells {
  gate: YesNo;
  /** Tiered: one value per option row. Binary: the follow-up row. */
  options: YesNo[];
}

const yn = (v: boolean | null | undefined): YesNo => (v === null || v === undefined ? null : v ? "Ja" : "Nein");

/** Converts an answer into the Ja/Nein cells the legacy sheet expects. */
export function answerToCells(def: ScenarioDef, answer: ScenarioAnswer | undefined): BlockCells {
  const applies = answer?.applies ?? null;
  if (def.kind === "binary") {
    const follow = applies && answer?.level != null ? yn(answer.level === 3) : null;
    return { gate: yn(applies), options: [follow] };
  }
  if (applies === null) return { gate: null, options: def.options.map(() => null) };
  if (!applies) return { gate: "Nein", options: def.options.map(() => "Nein") };
  if (answer?.level == null) return { gate: "Ja", options: def.options.map(() => null) };
  return { gate: "Ja", options: def.options.map((o) => (o.level === answer.level ? "Ja" : "Nein")) };
}

const CHECK = "Eingabe prüfen!";

/** Formula text (without "=") for column G of a scenario block, as in the legacy sheet. */
export function levelFormula(def: ScenarioDef, rowOffset = 0): string {
  const g = `E${def.gateRow + rowOffset}`;
  if (def.kind === "binary") {
    const f = `E${def.followUpRow + rowOffset}`;
    return `IF(AND(${g}="Nein",${f}="Ja"),"${CHECK}",IF(${g}="Nein","Normal",IF(AND(${g}="Ja",${f}="Nein"),"Hoch",IF(AND(${g}="Ja",${f}="Ja"),"Sehr hoch"))))`;
  }
  const [o1, o2, o3] = def.options.map((o) => `E${o.row + rowOffset}`);
  const chk = (cond: string) => `IF(${cond},"${CHECK}",`;
  return (
    chk(`AND(${o1}="Ja",${o2}="Ja",${o3}="Ja")`) +
    chk(`AND(${o1}="Ja",${o2}="Ja")`) +
    chk(`AND(${o1}="Ja",${o3}="Ja")`) +
    chk(`AND(${o2}="Ja",${o3}="Ja")`) +
    chk(`AND(${g}="Nein",${o1}="Ja")`) +
    chk(`AND(${g}="Nein",${o2}="Ja")`) +
    chk(`AND(${g}="Nein",${o3}="Ja")`) +
    chk(`AND(${g}="Ja",${o1}="Nein",${o2}="Nein",${o3}="Nein")`) +
    `IF(OR(${g}="Nein",${o1}="Ja"),"Normal",IF(${o2}="Ja","Hoch",IF(${o3}="Ja","Sehr hoch")))` +
    ")".repeat(8)
  );
}

/** Evaluates levelFormula the way Excel would, so exported files carry cached results. */
export function evaluateLevel(def: ScenarioDef, cells: BlockCells): string | false {
  const is = (v: YesNo, t: "Ja" | "Nein") => v === t;
  const g = cells.gate;
  if (def.kind === "binary") {
    const f = cells.options[0] ?? null;
    if (is(g, "Nein") && is(f, "Ja")) return CHECK;
    if (is(g, "Nein")) return "Normal";
    if (is(g, "Ja") && is(f, "Nein")) return "Hoch";
    if (is(g, "Ja") && is(f, "Ja")) return "Sehr hoch";
    return false;
  }
  const [o1 = null, o2 = null, o3 = null] = cells.options;
  const ja = [o1, o2, o3].filter((o) => is(o, "Ja")).length;
  if (ja > 1) return CHECK;
  if (is(g, "Nein") && ja > 0) return CHECK;
  if (is(g, "Ja") && is(o1, "Nein") && is(o2, "Nein") && is(o3, "Nein")) return CHECK;
  if (is(g, "Nein") || is(o1, "Ja")) return "Normal";
  if (is(o2, "Ja")) return "Hoch";
  if (is(o3, "Ja")) return "Sehr hoch";
  return false;
}

/** Helper table weight of a scenario result (legacy: Normal 1, Hoch 10, Sehr hoch 1000). */
export function weight(result: string | false): number {
  return result === "Normal" ? 1 : result === "Hoch" ? 10 : result === "Sehr hoch" ? 1000 : 0;
}

/** Helper table columns per goal: [label column, value column]. */
export const HELPER_COLUMNS: Record<Goal, [string, string]> = { C: ["A", "B"], I: ["C", "D"], A: ["E", "F"] };
export const HELPER_FIRST_ROW = 4;
export const HELPER_SUM_ROW = 10;

export function helperCellFormula(goal: Goal, index: number): string {
  const ref = `Anwendung!G${CATALOG[goal].scenarios[index]!.gateRow}`;
  return `IF(${ref}="Normal",1,(IF(${ref}="Hoch",10,(IF(${ref}="Sehr hoch",1000,0)))))`;
}

/** Goal header formula (Anwendung!E1/E37/E74). */
export function goalFormula(goal: Goal): string {
  const sum = `Hilfstabelle!${HELPER_COLUMNS[goal][1]}${HELPER_SUM_ROW}`;
  const allNormal = CATALOG[goal].scenarios.length;
  return `IF(${sum}=${allNormal},"Normal", IF(${sum}>=1000,"Sehr hoch",IF(${sum}>=10,"Hoch","Bitte Spalte E ausfüllen")))`;
}

export function evaluateGoal(goal: Goal, sum: number): string {
  if (sum === CATALOG[goal].scenarios.length) return "Normal";
  if (sum >= 1000) return "Sehr hoch";
  if (sum >= 10) return "Hoch";
  return "Bitte Spalte E ausfüllen";
}
