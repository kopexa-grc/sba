import { CATALOG } from "../../domain/catalog";
import { DEFAULT_SNAPSHOT, defaultSettings, type SchemeSnapshot, type Settings } from "../../domain/scheme";
import type { AssessmentVersion, Goal, ScenarioAnswer } from "../../domain/types";
import { branchVersion, closeVersion, newVersion } from "../../domain/versioning";

const no = (): ScenarioAnswer => ({ applies: false, level: null, notes: "", explanation: "" });

/** A non-default scheme so the configurable thresholds are visible in the output. */
export const SAMPLE_SCHEME: SchemeSnapshot = {
  ...DEFAULT_SNAPSHOT,
  name: "Mittelstand",
  revision: 3,
  financialHigh: 250_000,
  financialVeryHigh: 2_500_000,
  availabilityHighHours: 8,
  availabilityVeryHighHours: 2,
};

export function sampleSettings(): Settings {
  const s = defaultSettings();
  s.organization.name = "Muster GmbH";
  s.scheme = { ...s.scheme, ...SAMPLE_SCHEME };
  return s;
}

/** Sample data for report tests and visual checks. */
export async function sampleVersions(): Promise<{
  final: AssessmentVersion;
  draft: AssessmentVersion;
  history: AssessmentVersion[];
}> {
  const v = newVersion(
    "asset-1",
    "Anna Assessor <anna@example.com>",
    {
    name: "Kunden-CRM",
    type: "application",
    owner: "Leitung Vertrieb",
    orgUnit: "Vertrieb & Marketing",
    contact: "crm-team@example.com",
    assessor: "Anna Assessor",
    description:
      "Zentrales CRM zur Verwaltung von Kundenstammdaten, Verkaufschancen und Kommunikationshistorie inklusive Schnittstelle zum ERP-System.",
    scope: "Produktivsystem inkl. Schnittstellen zu ERP und Newsletter-Dienst; ohne Testumgebung.",
    location: "Rechenzentrum Frankfurt (Managed Hosting)",
    personalData: true,
    specialCategoryData: false,
    },
    SAMPLE_SCHEME,
  );
  for (const g of ["C", "I", "A"] as Goal[]) {
    for (const s of CATALOG[g].scenarios) v.answers[g][s.id] = no();
  }
  v.answers.C.privacy = {
    applies: true,
    level: 2,
    notes: "ca. 120.000 Kundendatensätze",
    explanation:
      "Das CRM enthält Kontakt- und Vertragsdaten sowie Zahlungsinformationen. Eine Offenlegung kann Betroffene wirtschaftlich erheblich beeinträchtigen und löst Meldepflichten nach Art. 33/34 DSGVO aus.",
  };
  v.answers.C.legal = {
    applies: true,
    level: 2,
    notes: "",
    explanation: "Vertraulichkeitsvereinbarungen mit Großkunden sehen Vertragsstrafen bei Datenabfluss vor.",
  };
  v.answers.A.operations = {
    applies: true,
    level: 3,
    notes: "Callcenter arbeitet ausschließlich im CRM.",
    explanation: "Bei Ausfall kann der Kundenservice nicht mehr arbeiten; tolerierbar sind höchstens 2 Stunden.",
  };
  v.answers.I.financial = { applies: true, level: 1, notes: "", explanation: "" };
  v.overrides.I = {
    level: 2,
    kind: "cumulation",
    reason: "Mehrere für sich normale Integritätsschäden (Rechnungsdaten, Angebote, Provisionen) summieren sich zu einem erheblichen Gesamtschaden.",
  };
  v.justifications = {
    C: "Verarbeitung umfangreicher personenbezogener Kundendaten mit vertraglichen Vertraulichkeitspflichten.",
    I: "Kumulationseffekt über mehrere abrechnungsrelevante Datenbestände.",
    A: "Kerngeschäftsprozess Kundenservice ist vollständig vom CRM abhängig (RTO ≤ 2 h).",
  };
  const final = closeVersion(v, "Anna Assessor <anna@example.com>");
  const draft = branchVersion(final, [final], "minor", "Anna Assessor", "Rezertifizierung 2027: neues Ticketmodul");
  draft.answers.C.privacy = { ...draft.answers.C.privacy!, level: 3, explanation: "" };
  draft.answers.A.financial = { applies: true, level: 2, notes: "", explanation: "Umsatzausfall im Kundenservice." };
  return { final, draft, history: [final, draft] };
}
