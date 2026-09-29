import { CATALOG, type ScenarioDef } from "./catalog";
import {
  GOALS,
  GOAL_LABEL,
  LEVEL_LABEL,
  type AssessmentVersion,
  type Goal,
  type GoalOverride,
  type ScenarioAnswer,
  type ScenarioId,
} from "./types";

export type Rated = 1 | 2 | 3;

/**
 * Level of a single scenario, or null while it is not fully answered.
 * Gate "Nein" means normal; gate "Ja" requires a selected impact level.
 */
export function scenarioLevel(answer: ScenarioAnswer | undefined): Rated | null {
  if (!answer || answer.applies === null) return null;
  if (!answer.applies) return 1;
  return answer.level;
}

export interface GoalResult {
  goal: Goal;
  /** Maximum over all answered scenarios (maximum principle), null if nothing answered. */
  computed: Rated | null;
  /** True once every scenario of the goal is answered. */
  complete: boolean;
  answered: number;
  total: number;
  /** Scenarios that determine the maximum. */
  drivers: ScenarioId[];
  override: GoalOverride | null;
  /** Override level if present, otherwise the computed level. */
  effective: Rated | null;
}

export function goalResult(version: Pick<AssessmentVersion, "answers" | "overrides">, goal: Goal): GoalResult {
  const defs = CATALOG[goal].scenarios;
  let computed: Rated | null = null;
  let answered = 0;
  for (const def of defs) {
    const level = scenarioLevel(version.answers[goal]?.[def.id]);
    if (level === null) continue;
    answered++;
    if (computed === null || level > computed) computed = level;
  }
  const drivers =
    computed === null
      ? []
      : defs.filter((d) => scenarioLevel(version.answers[goal]?.[d.id]) === computed).map((d) => d.id);
  const override = version.overrides[goal] ?? null;
  return {
    goal,
    computed,
    complete: answered === defs.length,
    answered,
    total: defs.length,
    drivers,
    override,
    effective: override ? override.level : computed,
  };
}

export function allResults(version: Pick<AssessmentVersion, "answers" | "overrides">): Record<Goal, GoalResult> {
  return { C: goalResult(version, "C"), I: goalResult(version, "I"), A: goalResult(version, "A") };
}

export function progress(version: Pick<AssessmentVersion, "answers" | "overrides">): { answered: number; total: number } {
  const r = allResults(version);
  return GOALS.reduce(
    (acc, g) => ({ answered: acc.answered + r[g].answered, total: acc.total + r[g].total }),
    { answered: 0, total: 0 },
  );
}

export interface Issue {
  severity: "error" | "warning";
  /** Where to fix it: "meta.name", "C.legal", "justification.C", "override.C". */
  path: string;
  message: string;
}

function scenarioIssues(goal: Goal, def: ScenarioDef, answer: ScenarioAnswer | undefined): Issue[] {
  const path = `${goal}.${def.id}`;
  const where = `${GOAL_LABEL[goal]} · ${def.title}`;
  if (!answer || answer.applies === null) {
    return [{ severity: "error", path, message: `${where}: Frage noch nicht beantwortet.` }];
  }
  if (answer.applies && answer.level === null) {
    return [{ severity: "error", path, message: `${where}: Schadensausmaß noch nicht ausgewählt.` }];
  }
  const level = scenarioLevel(answer);
  if (level !== null && level >= 2 && !answer.explanation.trim()) {
    return [
      {
        severity: "error",
        path,
        message: `${where}: Einstufung „${LEVEL_LABEL[level]}“ erfordert eine Erläuterung.`,
      },
    ];
  }
  return [];
}

/**
 * Plausibility checks. Errors block submitting for review and approval;
 * warnings are shown but do not block.
 */
export function validate(version: AssessmentVersion): Issue[] {
  const issues: Issue[] = [];
  if (!version.meta.name.trim()) {
    issues.push({ severity: "error", path: "meta.name", message: "Asset-Bezeichnung fehlt." });
  }
  if (!version.meta.owner.trim()) {
    issues.push({ severity: "error", path: "meta.owner", message: "Asset-Owner fehlt." });
  }
  if (!version.meta.assessor.trim()) {
    issues.push({ severity: "warning", path: "meta.assessor", message: "Ersteller:in der Analyse ist nicht angegeben." });
  }
  if (!version.meta.scope.trim()) {
    issues.push({ severity: "warning", path: "meta.scope", message: "Geltungsbereich ist nicht beschrieben." });
  }

  for (const goal of GOALS) {
    for (const def of CATALOG[goal].scenarios) {
      issues.push(...scenarioIssues(goal, def, version.answers[goal]?.[def.id]));
    }
    const r = goalResult(version, goal);
    if (r.override && !r.override.reason.trim()) {
      issues.push({
        severity: "error",
        path: `override.${goal}`,
        message: `${GOAL_LABEL[goal]}: Manuelle Übersteuerung erfordert eine Begründung.`,
      });
    }
    if (r.effective !== null && r.effective >= 2 && !version.justifications[goal].trim()) {
      issues.push({
        severity: "error",
        path: `justification.${goal}`,
        message: `${GOAL_LABEL[goal]}: Schutzbedarf „${LEVEL_LABEL[r.effective]}“ erfordert eine Begründung.`,
      });
    }
  }

  // Consistency between the cover sheet and the questionnaire.
  const privacyApplies = GOALS.some((g) => version.answers[g]?.privacy?.applies === true);
  const privacyDenied = GOALS.some((g) => version.answers[g]?.privacy?.applies === false);
  if (version.meta.personalData === false && privacyApplies) {
    issues.push({
      severity: "warning",
      path: "meta.personalData",
      message: "Stammdaten: „keine personenbezogenen Daten“, im Fragebogen wird jedoch eine Verarbeitung bejaht.",
    });
  }
  if (version.meta.personalData === true && privacyDenied) {
    issues.push({
      severity: "warning",
      path: "meta.personalData",
      message: "Stammdaten: personenbezogene Daten werden verarbeitet, im Fragebogen wird dies teilweise verneint.",
    });
  }
  if (version.meta.specialCategoryData === true) {
    for (const goal of ["C", "I"] as const) {
      const level = scenarioLevel(version.answers[goal]?.privacy);
      if (level === 1) {
        issues.push({
          severity: "warning",
          path: `${goal}.privacy`,
          message: `${GOAL_LABEL[goal]}: Besondere Kategorien personenbezogener Daten (Art. 9 DSGVO) sind meist mindestens „Hoch“ einzustufen.`,
        });
      }
    }
  }
  return issues;
}

export function hasBlockingIssues(version: AssessmentVersion): boolean {
  return validate(version).some((i) => i.severity === "error");
}
