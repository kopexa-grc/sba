import type { AssessmentVersion, AssetMeta, ScenarioAnswer } from "./types";

const no = (): ScenarioAnswer => ({ applies: false, level: null, notes: "", explanation: "" });
const yes = (level: 1 | 2 | 3, explanation: string, notes = ""): ScenarioAnswer => ({ applies: true, level, notes, explanation });

export const SAMPLE_META: Partial<AssetMeta> = {
  name: "Beispiel: Kunden-CRM",
  type: "application",
  owner: "Leitung Vertrieb",
  orgUnit: "Vertrieb & Marketing",
  contact: "crm-team@example.com",
  assessor: "Informationssicherheit (Beispiel)",
  description: "Zentrales CRM mit Kundenstammdaten, Verkaufschancen und Kommunikationshistorie, angebunden an das ERP-System.",
  scope: "Produktivsystem inklusive Schnittstellen zu ERP und Newsletter-Dienst; ohne Test- und Entwicklungsumgebung.",
  location: "Rechenzentrum Frankfurt (Managed Hosting)",
  personalData: true,
  specialCategoryData: false,
};

/** Fills a fresh version with a complete, realistic example assessment. */
export function applySample(v: AssessmentVersion): void {
  v.meta = { ...v.meta, ...SAMPLE_META };
  v.changeSummary = "Beispielanalyse";
  v.answers = {
    C: {
      legal: yes(2, "Vertraulichkeitsvereinbarungen mit Großkunden sehen Vertragsstrafen bei Datenabfluss vor."),
      privacy: yes(
        2,
        "Kontakt-, Vertrags- und Zahlungsdaten; eine Offenlegung löst Meldepflichten nach Art. 33/34 DSGVO aus.",
        "ca. 120.000 Kundendatensätze",
      ),
      operations: no(),
      reputation: yes(1, "Ein Vorfall wäre intern ärgerlich, aber ohne nennenswerte Außenwirkung."),
      financial: no(),
    },
    I: {
      legal: no(),
      privacy: yes(1, "Fehlerhafte Kontaktdaten lassen sich korrigieren und haben nur geringe Auswirkungen."),
      safety: no(),
      operations: yes(1, "Falsche Verkaufschancen fallen im Vertriebsprozess auf."),
      reputation: no(),
      financial: no(),
    },
    A: {
      legal: no(),
      privacy: yes(1, "Bei einem Ausfall sind die Daten nur vorübergehend nicht erreichbar; Betroffene merken davon nichts."),
      safety: no(),
      operations: yes(3, "Der Kundenservice arbeitet ausschließlich im CRM; tolerierbar ist höchstens eine Stunde Ausfall.", "Callcenter mit 40 Plätzen"),
      reputation: yes(2, "Längere Ausfälle sind für Großkunden sichtbar."),
      financial: no(),
    },
  };
  v.justifications = {
    C: "Verarbeitung umfangreicher personenbezogener Kundendaten mit vertraglichen Vertraulichkeitspflichten.",
    I: "",
    A: "Der Kundenservice ist vollständig vom CRM abhängig; ein Ausfall über eine Stunde ist nicht tolerierbar.",
  };
}
