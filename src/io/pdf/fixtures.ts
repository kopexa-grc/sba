import { CATALOG } from "../../domain/catalog";
import type { AssessmentVersion, Goal, ScenarioAnswer } from "../../domain/types";
import { approve, branchVersion, newVersion, submitForReview } from "../../domain/versioning";

const no = (): ScenarioAnswer => ({ applies: false, level: null, notes: "", explanation: "" });

/** Sample data for report tests and visual checks. */
export async function sampleVersions(): Promise<{
  approved: AssessmentVersion;
  draft: AssessmentVersion;
  history: AssessmentVersion[];
}> {
  const v = newVersion("asset-1", "Anna Assessor <anna@example.com>", {
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
  });
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
    explanation: "Bei Ausfall kann der Kundenservice nicht mehr arbeiten; tolerierbar ist höchstens 1 Stunde.",
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
    A: "Kerngeschäftsprozess Kundenservice ist vollständig vom CRM abhängig (RTO ≤ 1 h).",
  };
  const approved = await approve(
    submitForReview(v, "Anna Assessor <anna@example.com>", "Fachlich geprüft"),
    "Chris CISO <ciso@example.com>",
    "Freigabe im ISMS-Board",
  );
  const draft = branchVersion(approved, [approved], "minor", "Anna Assessor", "Rezertifizierung 2027: neues Ticketmodul");
  draft.answers.C.privacy = { ...draft.answers.C.privacy!, level: 3, explanation: "" };
  return { approved, draft, history: [approved, draft] };
}
