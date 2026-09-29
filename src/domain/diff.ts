import { CATALOG, SCENARIO_SHORT } from "./catalog";
import { formatEuro, formatHours } from "./scheme";
import { goalResult, scenarioLevel, type Rated } from "./scoring";
import {
  ASSET_TYPE_LABEL,
  GOALS,
  GOAL_LABEL,
  LEVEL_LABEL,
  OVERRIDE_KIND_LABEL,
  type AssessmentVersion,
  type AssetMeta,
  type Goal,
  type GoalOverride,
  type ScenarioId,
} from "./types";

/**
 * escalated: stricter protection level (red)
 * relaxed:   lower protection level (green)
 * reasoning: new or changed justification text (green)
 * context:   master data, scope, contacts (yellow)
 */
export type ChangeKind = "escalated" | "relaxed" | "reasoning" | "context";

export interface Change {
  path: string;
  label: string;
  kind: ChangeKind;
  oldValue: string | null;
  newValue: string | null;
  /** True for changes of a protection level, which require a documented reason. */
  isRating: boolean;
}

export const META_LABEL: Record<keyof AssetMeta, string> = {
  name: "Asset-Bezeichnung",
  type: "Asset-Typ",
  owner: "Asset-Owner",
  orgUnit: "Verantwortliche Organisationseinheit",
  contact: "Kontakt",
  assessor: "Ersteller:in",
  description: "Beschreibung / Einsatzzweck",
  scope: "Geltungsbereich",
  location: "Standort",
  personalData: "Personenbezogene Daten",
  specialCategoryData: "Besondere Kategorien personenbezogener Daten",
};

function fmtBool(v: boolean | null): string | null {
  return v === null ? null : v ? "Ja" : "Nein";
}

function fmtMeta(key: keyof AssetMeta, meta: AssetMeta): string | null {
  const v = meta[key];
  if (key === "type") return ASSET_TYPE_LABEL[meta.type];
  if (typeof v === "boolean" || v === null) return fmtBool(v as boolean | null);
  return v === "" ? null : String(v);
}

function fmtLevel(l: Rated | null): string | null {
  return l === null ? null : LEVEL_LABEL[l];
}

function fmtOverride(o: GoalOverride | null): string | null {
  return o ? `${LEVEL_LABEL[o.level]} (${OVERRIDE_KIND_LABEL[o.kind]})` : null;
}

function levelKind(a: Rated | null, b: Rated | null): ChangeKind {
  return (b ?? 0) > (a ?? 0) ? "escalated" : "relaxed";
}

function text(v: string): string | null {
  return v.trim() === "" ? null : v;
}

/** Field-level differences from version a to version b. */
export function diffVersions(a: AssessmentVersion, b: AssessmentVersion): Change[] {
  const out: Change[] = [];
  const push = (c: Omit<Change, "isRating"> & { isRating?: boolean }) => {
    if (c.oldValue !== c.newValue) out.push({ isRating: false, ...c });
  };

  for (const key of Object.keys(META_LABEL) as (keyof AssetMeta)[]) {
    push({
      path: `meta.${key}`,
      label: META_LABEL[key],
      kind: "context",
      oldValue: fmtMeta(key, a.meta),
      newValue: fmtMeta(key, b.meta),
    });
  }

  const schemeLabel = (v: AssessmentVersion) =>
    `${v.scheme.name} (Stand ${v.scheme.revision}): hoch ab ${formatEuro(v.scheme.financialHigh)}, sehr hoch ab ${formatEuro(
      v.scheme.financialVeryHigh,
    )}, Ausfall ${formatHours(v.scheme.availabilityHighHours)} / ${formatHours(v.scheme.availabilityVeryHighHours)}`;
  push({
    path: "scheme",
    label: "Bewertungsschema",
    kind: "context",
    oldValue: schemeLabel(a),
    newValue: schemeLabel(b),
  });

  push({
    path: "changeSummary",
    label: "Anlass der Version",
    kind: "context",
    oldValue: text(a.changeSummary),
    newValue: text(b.changeSummary),
  });

  for (const goal of GOALS) {
    for (const def of CATALOG[goal].scenarios) {
      const pa = a.answers[goal]?.[def.id];
      const pb = b.answers[goal]?.[def.id];
      const la = scenarioLevel(pa);
      const lb = scenarioLevel(pb);
      const base = `${GOAL_LABEL[goal]} · ${SCENARIO_SHORT[def.id]}`;
      if (la !== lb) {
        push({
          path: `${goal}.${def.id}`,
          label: base,
          kind: levelKind(la, lb),
          oldValue: fmtLevel(la),
          newValue: fmtLevel(lb),
          isRating: la !== null && lb !== null,
        });
      } else if ((pa?.applies ?? null) !== (pb?.applies ?? null)) {
        // Same resulting level but different path (e.g. "Nein" vs. "Ja, geringfügig").
        push({
          path: `${goal}.${def.id}.applies`,
          label: `${base} (Vorfrage)`,
          kind: "reasoning",
          oldValue: fmtBool(pa?.applies ?? null),
          newValue: fmtBool(pb?.applies ?? null),
        });
      }
      push({
        path: `${goal}.${def.id}.explanation`,
        label: `${base} – Erläuterung`,
        kind: "reasoning",
        oldValue: text(pa?.explanation ?? ""),
        newValue: text(pb?.explanation ?? ""),
      });
      push({
        path: `${goal}.${def.id}.notes`,
        label: `${base} – Weitere Ausführungen`,
        kind: "reasoning",
        oldValue: text(pa?.notes ?? ""),
        newValue: text(pb?.notes ?? ""),
      });
    }

    const ra = goalResult(a, goal);
    const rb = goalResult(b, goal);
    push({
      path: `override.${goal}`,
      label: `${GOAL_LABEL[goal]} – Manuelle Übersteuerung`,
      kind: levelKind(ra.effective, rb.effective),
      oldValue: fmtOverride(a.overrides[goal]),
      newValue: fmtOverride(b.overrides[goal]),
      isRating: true,
    });
    if (a.overrides[goal] && b.overrides[goal]) {
      push({
        path: `override.${goal}.reason`,
        label: `${GOAL_LABEL[goal]} – Begründung der Übersteuerung`,
        kind: "reasoning",
        oldValue: text(a.overrides[goal]!.reason),
        newValue: text(b.overrides[goal]!.reason),
      });
    }
    push({
      path: `justification.${goal}`,
      label: `${GOAL_LABEL[goal]} – Begründung Schutzbedarf`,
      kind: "reasoning",
      oldValue: text(a.justifications[goal]),
      newValue: text(b.justifications[goal]),
    });
  }
  return out;
}

/**
 * Rating changes from `current` to `next` that must be documented with a reason:
 * a scenario or goal override that had a rating before - either in the current
 * draft or in the approved baseline the draft was branched from - and now gets a
 * different one. Comparing with the baseline closes the gap of re-rating in two
 * steps via "open" (Normal -> open -> Hoch).
 */
export function reclassifications(
  current: AssessmentVersion,
  next: AssessmentVersion,
  baseline: AssessmentVersion | null,
): Change[] {
  const baseValue = (path: string): string | null => {
    if (!baseline) return null;
    const [head, id] = path.split(".");
    if (head === "override") return fmtOverride(baseline.overrides[id as Goal]);
    return fmtLevel(scenarioLevel(baseline.answers[head as Goal]?.[id as ScenarioId]));
  };
  return diffVersions(current, next)
    .filter((c) => c.isRating || /^[CIA]\.[a-z]+$/.test(c.path) || c.path.startsWith("override."))
    .filter((c) => !c.path.endsWith(".reason") && c.newValue !== null)
    .map((c) => ({ ...c, oldValue: c.oldValue ?? baseValue(c.path) }))
    .filter((c) => c.oldValue !== null && c.oldValue !== c.newValue);
}

/** Aggregated protection level changes per goal (for the diff header). */
export function goalLevelChanges(a: AssessmentVersion, b: AssessmentVersion) {
  return GOALS.map((goal) => {
    const from = goalResult(a, goal).effective;
    const to = goalResult(b, goal).effective;
    return { goal, from, to, kind: from === to ? null : levelKind(from, to) };
  });
}
