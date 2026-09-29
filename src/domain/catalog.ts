import type { Goal, ScenarioId } from "./types";

/**
 * Question catalog, transcribed from sheet "Anwendung" of the legacy workbook
 * FS_Schutzbedarfsanalyse_neu.xlsx. Row numbers refer to that sheet and are used
 * by both the XLSX import (reading answers) and the XLSX export (writing a
 * structurally identical sheet).
 */

export interface LevelOption {
  level: 1 | 2 | 3;
  text: string;
  /** Legacy row whose column E holds the Ja/Nein answer for this option. */
  row: number;
}

export interface ScenarioDef {
  id: ScenarioId;
  title: string;
  /** Short hint for the wizard. */
  hint: string;
  /** Gate question; "Nein" means protection level normal. */
  gate: string;
  gateRow: number;
  /** Lead-in sentence for the level options ("Falls ja, ..."). */
  followUp: string;
  followUpRow: number;
  /**
   * "tiered": three mutually exclusive Ja/Nein rows (normal/high/very high).
   * "binary": one follow-up Ja/Nein row; Nein = high, Ja = very high.
   */
  kind: "tiered" | "binary";
  options: LevelOption[];
}

export interface NotApplicableDef {
  id: ScenarioId;
  title: string;
  notApplicable: string;
  row: number;
}

export interface GoalDef {
  goal: Goal;
  title: string;
  /** Row of the goal header; column E holds the aggregated level. */
  headerRow: number;
  /** Verb phrase used in the follow-up sentences. */
  event: string;
  scenarios: ScenarioDef[];
  notApplicable: NotApplicableDef[];
}

export const SCENARIO_TITLE: Record<ScenarioId, string> = {
  legal: "Verstoß gegen Gesetze, Vorschriften und Verträge",
  privacy: "Beeinträchtigung des informationellen Selbstbestimmungsrechts",
  safety: "Beeinträchtigung der persönlichen Unversehrtheit",
  operations: "Beeinträchtigung der Aufgabenerfüllung",
  reputation: "Negative Innen- oder Außenwirkung",
  financial: "Finanzielle Auswirkungen",
};

export const SCENARIO_SHORT: Record<ScenarioId, string> = {
  legal: "Gesetze & Verträge",
  privacy: "Selbstbestimmung / DSGVO",
  safety: "Leib & Leben",
  operations: "Aufgabenerfüllung",
  reputation: "Innen-/Außenwirkung",
  financial: "Finanzielle Auswirkungen",
};

export const SCENARIO_HINT: Record<ScenarioId, string> = {
  legal: "Gesetzliche, regulatorische oder vertragliche Anforderungen (z. B. DSGVO, KRITIS, DORA, NDA, SLA).",
  privacy: "Personenbezogene Daten von Beschäftigten, Kunden oder sonstigen Betroffenen.",
  safety: "Gesundheit, Leib und Leben von Menschen.",
  operations: "Betriebsstörungen, Geschäftsausfall, verzögerte oder fehlerhafte Aufgabenerfüllung.",
  reputation: "Ansehens- und Vertrauensverlust intern, bei Kunden, Partnern oder in der Öffentlichkeit.",
  financial: "Direkte Schäden, Vertragsstrafen, Haftung, Umsatzausfall.",
};

const legalOptions = (base: number): LevelOption[] => [
  {
    level: 1,
    text: "geringen Verstößen gegen diese Regelungen und damit zu geringfügigen juristischen Konsequenzen / Vertragsstrafen",
    row: base,
  },
  {
    level: 2,
    text: "erheblichen Verstößen gegen diese Regelungen und damit zu erheblichen juristischen Konsequenzen / Vertragsstrafen",
    row: base + 1,
  },
  {
    level: 3,
    text: "fundamentalen Verstößen gegen diese Regelungen und damit zu massiven juristischen Konsequenzen / Vertragsstrafen",
    row: base + 2,
  },
];

const reputationOptions = (base: number): LevelOption[] => [
  { level: 1, text: "einer geringen bzw. nur ressortinternen Ansehens- / Vertrauensbeeinträchtigung", row: base },
  { level: 2, text: "einer erheblichen Ansehens- / Vertrauensbeeinträchtigung auch außerhalb des Ressorts", row: base + 1 },
  {
    level: 3,
    text: "einer dauerhaften Ansehens- / Vertrauensbeeinträchtigung außerhalb des Ressorts, ggf. sogar auf internationaler Ebene",
    row: base + 2,
  },
];

const financialOptions = (base: number): LevelOption[] => [
  { level: 1, text: "einem finanziellen Schaden von weniger als 1.000.000,00 €", row: base },
  { level: 2, text: "einem finanziellen Schaden von mehr als 1.000.000,00 €", row: base + 1 },
  { level: 3, text: "einem finanziellen Schaden von mehr als 10.000.000,00 €", row: base + 2 },
];

const privacyOptions = (base: number, lowest: string): LevelOption[] => [
  { level: 1, text: lowest, row: base },
  {
    level: 2,
    text: "erhebliche Auswirkungen auf die Betroffenen und kann diese in ihrer gesellschaftlichen Stellung oder ihren wirtschaftlichen Verhältnissen erheblich beeinträchtigen",
    row: base + 1,
  },
  {
    level: 3,
    text: "fundamentale Auswirkungen auf die Betroffenen und kann für diese eine Gefahr für Leib und Leben oder die persönliche Freiheit darstellen",
    row: base + 2,
  },
];

function scenario(
  id: ScenarioId,
  gate: string,
  gateRow: number,
  followUp: string,
  kind: ScenarioDef["kind"],
  options: LevelOption[],
): ScenarioDef {
  return {
    id,
    title: SCENARIO_TITLE[id],
    hint: SCENARIO_HINT[id],
    gate,
    gateRow,
    followUp,
    followUpRow: gateRow + 1,
    kind,
    options,
  };
}

export const CATALOG: Record<Goal, GoalDef> = {
  C: {
    goal: "C",
    title: "Grundwert Vertraulichkeit",
    headerRow: 1,
    event: "die Kenntnisnahme der Informationen durch Unbefugte",
    scenarios: [
      scenario(
        "legal",
        "Erfordern Gesetze, Vorschriften oder vertragliche Regelungen die Vertraulichkeit der Informationen?",
        3,
        "Falls ja, führt die Kenntnisnahme der Informationen durch Unbefugte zu …",
        "tiered",
        legalOptions(5),
      ),
      scenario(
        "privacy",
        "Erfolgt eine Verarbeitung von personenbezogenen Daten?",
        9,
        "Falls ja, hat die Kenntnisnahme der personenbezogenen Daten durch Unbefugte …",
        "tiered",
        privacyOptions(11, "geringfügige Auswirkungen auf die Betroffenen und wird von diesen toleriert"),
      ),
      scenario(
        "operations",
        "Ist die Vertraulichkeit der Informationen Grundlage der Aufgabenerfüllung?",
        17,
        "Falls ja, hat die Kenntnisnahme der Informationen durch Unbefugte …",
        "tiered",
        [
          { level: 1, text: "geringfügige Auswirkungen auf die Aufgabenerfüllung und wird von diesen toleriert", row: 19 },
          {
            level: 2,
            text: "erhebliche Auswirkungen auf die Aufgabenerfüllung und wird von einzelnen Betroffenen als nicht tolerierbar eingeschätzt",
            row: 20,
          },
          {
            level: 3,
            text: "fundamentale Auswirkungen auf die Aufgabenerfüllung und wird von allen Betroffenen als nicht tolerierbar eingeschätzt",
            row: 21,
          },
        ],
      ),
      scenario(
        "reputation",
        "Erfolgt eine Verarbeitung schutzbedürftiger Informationen?",
        23,
        "Falls ja, führt die Kenntnisnahme der Informationen durch Unbefugte zu …",
        "tiered",
        reputationOptions(25),
      ),
      scenario(
        "financial",
        "Erfolgt eine Verarbeitung schutzbedürftiger Informationen?",
        29,
        "Falls ja, führt die Kenntnisnahme der Informationen durch Unbefugte zu …",
        "tiered",
        financialOptions(31),
      ),
    ],
    notApplicable: [
      {
        id: "safety",
        title: SCENARIO_TITLE.safety,
        notApplicable:
          "Eine Betrachtung dieses Szenarios beim Grundwert Vertraulichkeit ist nicht sinnvoll, da keine Unmittelbarkeit zwischen Vertraulichkeitsverlust und Beeinträchtigung denkbar ist.",
        row: 15,
      },
    ],
  },
  I: {
    goal: "I",
    title: "Grundwert Integrität",
    headerRow: 37,
    event: "die Verfälschung/Manipulation der Informationen",
    scenarios: [
      scenario(
        "legal",
        "Erfordern Gesetze, Vorschriften oder vertragliche Regelungen die Integrität der Informationen?",
        39,
        "Falls ja, führt die Verfälschung/Manipulation der Informationen zu …",
        "tiered",
        legalOptions(41),
      ),
      scenario(
        "privacy",
        "Erfolgt eine Verarbeitung von personenbezogenen Daten?",
        45,
        "Falls ja, hat die Verfälschung/Manipulation der personenbezogenen Daten …",
        "tiered",
        privacyOptions(47, "geringfügige Auswirkungen auf die Betroffenen und wird von diesen toleriert"),
      ),
      scenario(
        "safety",
        "Können Menschen durch manipulierte Programmabläufe oder Daten gesundheitlich beeinträchtigt werden?",
        51,
        "Falls ja, besteht durch die Verfälschung/Manipulation der Informationen/Programmabläufe eine Gefahr für Leib und Leben?",
        "binary",
        [
          { level: 2, text: "Nein – gesundheitliche Beeinträchtigung möglich, aber keine Gefahr für Leib und Leben", row: 52 },
          { level: 3, text: "Ja – es besteht Gefahr für Leib und Leben", row: 52 },
        ],
      ),
      scenario(
        "operations",
        "Ist die Integrität der Informationen Grundlage der Aufgabenerfüllung?",
        54,
        "Falls ja, hat die Verfälschung/Manipulation der Informationen …",
        "tiered",
        [
          { level: 1, text: "geringfügige Auswirkungen auf die Aufgabenerfüllung und wird von den Betroffenen toleriert", row: 56 },
          {
            level: 2,
            text: "erhebliche Auswirkungen auf die Aufgabenerfüllung und wird von einzelnen Betroffenen als nicht tolerierbar eingeschätzt",
            row: 57,
          },
          {
            level: 3,
            text: "fundamentale Auswirkungen auf die Aufgabenerfüllung und wird von allen Betroffenen als nicht tolerierbar eingeschätzt",
            row: 58,
          },
        ],
      ),
      scenario(
        "reputation",
        "Erfolgt eine Verarbeitung schutzbedürftiger Informationen?",
        60,
        "Falls ja, führt die Verfälschung/Manipulation der Informationen zu …",
        "tiered",
        reputationOptions(62),
      ),
      scenario(
        "financial",
        "Erfolgt eine Verarbeitung schutzbedürftiger Informationen?",
        66,
        "Falls ja, führt die Verfälschung/Manipulation der Informationen zu …",
        "tiered",
        financialOptions(68),
      ),
    ],
    notApplicable: [],
  },
  A: {
    goal: "A",
    title: "Grundwert Verfügbarkeit",
    headerRow: 74,
    event: "die Nichtverfügbarkeit der Informationen",
    scenarios: [
      scenario(
        "legal",
        "Erfordern Gesetze, Vorschriften oder vertragliche Regelungen die Verfügbarkeit der Informationen?",
        76,
        "Falls ja, führt die Nichtverfügbarkeit der Informationen zu …",
        "tiered",
        legalOptions(78),
      ),
      scenario(
        "privacy",
        "Erfolgt eine Verarbeitung von personenbezogenen Daten?",
        82,
        "Falls ja, hat die Nichtverfügbarkeit der personenbezogenen Daten …",
        "tiered",
        privacyOptions(84, "keine Auswirkungen auf die Betroffenen"),
      ),
      scenario(
        "safety",
        // The legacy sheet copied the integrity wording here; availability is about outages.
        "Können Menschen durch den Ausfall der Anwendung / des IT-Systems oder die Störung der Datenübertragung gesundheitlich beeinträchtigt werden?",
        88,
        "Falls ja, besteht durch die Nichtverfügbarkeit der Informationen/Programmabläufe eine Gefahr für Leib und Leben?",
        "binary",
        [
          { level: 2, text: "Nein – gesundheitliche Beeinträchtigung möglich, aber keine Gefahr für Leib und Leben", row: 89 },
          { level: 3, text: "Ja – es besteht Gefahr für Leib und Leben", row: 89 },
        ],
      ),
      scenario(
        "operations",
        "Ist die Verfügbarkeit der Informationen Grundlage der Aufgabenerfüllung?",
        91,
        "Falls ja, hat die Nichtverfügbarkeit der Informationen …",
        "tiered",
        [
          {
            level: 1,
            text: "geringfügige Auswirkungen auf die Aufgabenerfüllung und wird auch bei einer Dauer über 24 Stunden hinaus von den Betroffenen toleriert",
            row: 93,
          },
          {
            level: 2,
            text: "erhebliche Auswirkungen auf die Aufgabenerfüllung und kann nur bei einer Dauer zwischen 1 und 24 Stunden von den Betroffenen toleriert werden",
            row: 94,
          },
          {
            level: 3,
            text: "fundamentale Auswirkungen auf die Aufgabenerfüllung und kann nur bis zu einer Dauer von 1 Stunde von den Betroffenen toleriert werden",
            row: 95,
          },
        ],
      ),
      scenario(
        "reputation",
        "Erfolgt eine Verarbeitung schutzbedürftiger Informationen?",
        97,
        "Falls ja, führt die Nichtverfügbarkeit der Informationen zu …",
        "tiered",
        reputationOptions(99),
      ),
      scenario(
        "financial",
        "Erfolgt eine Verarbeitung schutzbedürftiger Informationen?",
        103,
        "Falls ja, führt die Nichtverfügbarkeit der Informationen zu …",
        "tiered",
        financialOptions(105),
      ),
    ],
    notApplicable: [],
  },
};

export function scenarioDef(goal: Goal, id: ScenarioId): ScenarioDef | undefined {
  return CATALOG[goal].scenarios.find((s) => s.id === id);
}

/** Total number of answerable scenarios across all goals (5 + 6 + 6). */
export const SCENARIO_COUNT = CATALOG.C.scenarios.length + CATALOG.I.scenarios.length + CATALOG.A.scenarios.length;
