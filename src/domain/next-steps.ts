import { allResults } from "./scoring";
import type { AssessmentVersion } from "./types";

export interface NextStep {
  id: "risk-analysis" | "controls" | "bia" | "dependencies" | "dpia" | "review";
  title: string;
  body: string;
  /** Background reading (knowledge pages, not product pages). */
  link?: { href: string; label: string };
  /** In-app follow-up the UI can offer. */
  action?: "capture-assets";
}

const KOPEXA = "https://kopexa.com/de";

/** Follow-up steps in the ISMS, derived from the result of one analysis. */
export function nextSteps(v: AssessmentVersion): NextStep[] {
  const r = allResults(v);
  const high = (["C", "I", "A"] as const).filter((g) => (r[g].effective ?? 0) >= 2);
  const steps: NextStep[] = [];

  if (high.length > 0) {
    steps.push({
      id: "risk-analysis",
      title: "Risikoanalyse durchführen",
      body: "Für Objekte mit hohem oder sehr hohem Schutzbedarf reichen Standardmaßnahmen oft nicht. Nach BSI-Standard 200-3 folgt eine Risikoanalyse; bei ISO 27001 fließt die Einstufung in die Risikobewertung und -behandlung ein.",
      link: { href: `${KOPEXA}/glossary/risikoanalyse`, label: "Was ist eine Risikoanalyse?" },
    });
  }

  steps.push({
    id: "controls",
    title: "Maßnahmen festlegen und Controls zuordnen",
    body:
      high.length > 0
        ? "Leiten Sie aus dem Schutzbedarf konkrete Maßnahmen ab und ordnen Sie sie den Controls Ihres Rahmenwerks zu, etwa ISO 27001 Anhang A oder den Bausteinen des IT-Grundschutzes."
        : "Bei normalem Schutzbedarf genügen in der Regel die Standardmaßnahmen Ihres Rahmenwerks, etwa ISO 27001 Anhang A oder die Basis- und Standard-Anforderungen des IT-Grundschutzes.",
    link: { href: `${KOPEXA}/catalog/iso-27001/controls`, label: "ISO 27001 Controls im Überblick" },
  });

  if ((r.A.effective ?? 0) >= 2) {
    steps.push({
      id: "bia",
      title: "Business-Impact-Analyse durchführen",
      body: "Hohe Verfügbarkeitsanforderungen brauchen belastbare Werte für tolerierbare Ausfallzeit und Wiederanlauf (RTO/RPO) – Grundlage für Notfallvorsorge und Datensicherung.",
      link: { href: `${KOPEXA}/glossary/business-impact-analysis-bia`, label: "Was ist eine Business-Impact-Analyse?" },
    });
  }

  if (v.meta.type === "application" || v.meta.type === "process" || v.meta.type === "information-domain") {
    steps.push({
      id: "dependencies",
      title: "Abhängige Systeme bewerten",
      body: "Server, Netze, Cloud-Dienste und Räume, auf die sich dieses Asset stützt, erben seinen Schutzbedarf nach dem Maximumprinzip. Legen Sie für sie eigene Analysen an.",
      link: { href: `${KOPEXA}/glossary/maximumprinzip`, label: "Maximumprinzip und Vererbung" },
      action: "capture-assets",
    });
  }

  if (v.meta.personalData && (r.C.effective ?? 0) >= 2) {
    steps.push({
      id: "dpia",
      title: "Datenschutz-Folgenabschätzung prüfen",
      body: "Bei personenbezogenen Daten mit hohem Vertraulichkeitsbedarf – insbesondere besonderen Kategorien nach Art. 9 DSGVO – kann eine Datenschutz-Folgenabschätzung nach Art. 35 DSGVO erforderlich sein. Stimmen Sie das mit Ihrer Datenschutzbeauftragten ab.",
    });
  }

  steps.push({
    id: "review",
    title: "Regelmäßig überprüfen",
    body: "Schließen Sie die Version ab und prüfen Sie die Einstufung mindestens jährlich oder bei wesentlichen Änderungen – neue Datenarten, Verträge oder Abhängigkeiten – in einer neuen Version.",
    link: { href: `${KOPEXA}/glossary/schutzbedarfsfeststellung`, label: "Schutzbedarfsfeststellung im Überblick" },
  });

  return steps;
}
