import type { Goal, ScenarioId } from "./types";

/**
 * Protection requirement categories, transcribed from sheet
 * "Schutzbedarfskategorien" of the legacy workbook (BSI 200-2 style).
 */
export interface CategoryDefinition {
  scenario: ScenarioId;
  normal: Record<Goal, string>;
  high: Record<Goal, string>;
  veryHigh: Record<Goal, string>;
}

export const DEFINITIONS: CategoryDefinition[] = [
  {
    scenario: "legal",
    normal: {
      C: "Gesetzliche/vertragliche Regelungen, die die Vertraulichkeit der Informationen fordern, sind entweder nicht existent oder die Kenntnisnahme der Informationen durch Unbefugte führt zu geringen Verstößen gegen gesetzliche/vertragliche Regelungen und damit zu geringfügigen juristischen Konsequenzen/Vertragsstrafen.",
      I: "Gesetzliche/vertragliche Regelungen, die die Integrität der Informationen fordern, sind entweder nicht existent oder die Verfälschung/Manipulation der Informationen führt zu geringen Verstößen gegen gesetzliche/vertragliche Regelungen und damit zu geringfügigen juristischen Konsequenzen/Vertragsstrafen.",
      A: "Gesetzliche/vertragliche Regelungen, die die Verfügbarkeit der Informationen fordern, sind entweder nicht existent oder die Nichtverfügbarkeit der Information (Ausfall der Anwendung oder Störung der Datenübertragung) führt nicht zur Nichteinhaltung zwingender Termine und damit zu geringfügigen juristischen Konsequenzen/Vertragsstrafen.",
    },
    high: {
      C: "Die Kenntnisnahme der Informationen durch Unbefugte führt zu erheblichen Verstößen gegen gesetzliche/vertragliche Regelungen und damit zu erheblichen juristischen Konsequenzen/Vertragsstrafen.",
      I: "Die Verfälschung/Manipulation der Informationen führt zu erheblichen Verstößen gegen gesetzliche/vertragliche Regelungen und damit zu erheblichen juristischen Konsequenzen/Vertragsstrafen.",
      A: "Die Nichtverfügbarkeit führt zu erheblichen Verstößen gegen gesetzliche/vertragliche Regelungen. Die Einhaltung zwingender Termine wird gefährdet; erhebliche juristische Konsequenzen/Vertragsstrafen können entstehen.",
    },
    veryHigh: {
      C: "Die Kenntnisnahme der Informationen durch Unbefugte führt zu fundamentalen Verstößen gegen gesetzliche/vertragliche Regelungen und damit zu massiven juristischen Konsequenzen/Vertragsstrafen.",
      I: "Die Verfälschung/Manipulation der Informationen führt zu fundamentalen Verstößen gegen gesetzliche/vertragliche Regelungen und damit zu massiven juristischen Konsequenzen/Vertragsstrafen.",
      A: "Die Nichtverfügbarkeit der Informationen führt zu fundamentalen Verstößen gegen gesetzliche/vertragliche Regelungen. Zwingend einzuhaltende Termine werden versäumt, massive juristische Konsequenzen/Vertragsstrafen können entstehen.",
    },
  },
  {
    scenario: "privacy",
    normal: {
      C: "Es erfolgt keine Verarbeitung von personenbezogenen Daten oder die Kenntnisnahme der personenbezogenen Daten durch Unbefugte hat geringfügige Auswirkungen auf die Betroffenen und wird von diesen toleriert.",
      I: "Es erfolgt keine Verarbeitung von personenbezogenen Daten oder die Verfälschung/Manipulation personenbezogener Daten hat geringfügige Auswirkungen auf die Betroffenen und wird von diesen toleriert.",
      A: "Es erfolgt keine Verarbeitung von personenbezogenen Daten oder die Nichtverfügbarkeit personenbezogener Daten hat keine Auswirkungen auf die Betroffenen.",
    },
    high: {
      C: "Die Kenntnisnahme der personenbezogenen Daten durch Unbefugte hat erhebliche Auswirkungen auf die Betroffenen und kann sie in ihrer gesellschaftlichen Stellung oder ihren wirtschaftlichen Verhältnissen erheblich beeinträchtigen. Dies ist z. B. der Fall, wenn Informationen über den Gesundheitszustand oder die finanziellen Verhältnisse enthalten sind.",
      I: "Die Verfälschung/Manipulation personenbezogener Daten hat erhebliche Auswirkungen auf die Betroffenen und kann diese in ihrer gesellschaftlichen Stellung oder ihren wirtschaftlichen Verhältnissen erheblich beeinträchtigen.",
      A: "Die Nichtverfügbarkeit der Daten hat erhebliche Auswirkungen auf die Betroffenen und kann diese in ihrer gesellschaftlichen Stellung beeinträchtigen oder zu persönlichen oder wirtschaftlichen Nachteilen führen. Das ist z. B. der Fall, wenn durch Ausfall der Anwendung oder Störung der Datenübertragung personenbezogene Daten verloren gehen oder verfälscht werden.",
    },
    veryHigh: {
      C: "Die Kenntnisnahme der personenbezogenen Daten durch Unbefugte hat fundamentale Auswirkungen auf die Betroffenen und kann für diese eine Gefahr für Leib und Leben oder die persönliche Freiheit darstellen. Dies ist z. B. der Fall, wenn Daten von Personen mit speziellen Funktionen/Befugnissen durch Unbefugte zur Kenntnis genommen werden können.",
      I: "Die Verfälschung/Manipulation personenbezogener Daten hat fundamentale Auswirkungen auf die Betroffenen und kann für diese eine Gefahr für Leib und Leben oder die persönliche Freiheit darstellen.",
      A: "Die Nichtverfügbarkeit der Daten hat fundamentale Auswirkungen auf die Betroffenen und kann für diese eine Gefahr für Leib und Leben oder die persönliche Freiheit darstellen. Das ist z. B. der Fall, wenn durch Ausfall der Anwendung oder Störung der Datenübertragung personenbezogene Daten verloren gehen oder verfälscht werden.",
    },
  },
  {
    scenario: "safety",
    normal: {
      C: "Die Kenntnisnahme der Informationen durch Unbefugte führt nicht zu einer Beeinträchtigung der persönlichen Unversehrtheit.",
      I: "Die Verfälschung/Manipulation der Informationen oder Programmabläufe führt nicht zu einer Beeinträchtigung der persönlichen Unversehrtheit.",
      A: "Die Nichtverfügbarkeit der Informationen führt nicht zu einer Beeinträchtigung der persönlichen Unversehrtheit.",
    },
    high: {
      C: "Eine Beeinträchtigung der persönlichen Unversehrtheit durch Kenntnisnahme der Informationen durch Unbefugte kann nicht absolut ausgeschlossen werden.",
      I: "Eine Beeinträchtigung der persönlichen Unversehrtheit durch Verfälschung/Manipulation der Informationen oder Programmabläufe kann nicht absolut ausgeschlossen werden.",
      A: "Eine Beeinträchtigung der persönlichen Unversehrtheit durch Nichtverfügbarkeit der Informationen (Ausfall der Anwendung oder Störung der Datenübertragung) kann nicht absolut ausgeschlossen werden.",
    },
    veryHigh: {
      C: "Durch Kenntnisnahme der Informationen durch Unbefugte sind gravierende Beeinträchtigungen der persönlichen Unversehrtheit möglich. Es besteht Gefahr für Leib und Leben.",
      I: "Durch Verfälschung/Manipulation der Informationen oder Programmabläufe sind gravierende Beeinträchtigungen der persönlichen Unversehrtheit möglich. Es besteht Gefahr für Leib und Leben.",
      A: "Durch Ausfall der Anwendung / des IT-Systems oder Störung der Datenübertragung sind gravierende Beeinträchtigungen der persönlichen Unversehrtheit möglich. Es besteht Gefahr für Leib und Leben.",
    },
  },
  {
    scenario: "operations",
    normal: {
      C: "Die Vertraulichkeit der Informationen ist nicht Grundlage der Aufgabenerfüllung oder die Kenntnisnahme der Informationen durch Unbefugte hat geringfügige Auswirkungen auf die Aufgabenerfüllung und wird von den Betroffenen toleriert.",
      I: "Die Integrität der Informationen ist nicht Grundlage der Aufgabenerfüllung oder die Verfälschung/Manipulation der Informationen hat geringfügige Auswirkungen auf die Aufgabenerfüllung und wird von den Betroffenen toleriert.",
      A: "Die Verfügbarkeit der Informationen ist nicht Grundlage der Aufgabenerfüllung oder die Nichtverfügbarkeit der Informationen hat geringfügige Auswirkungen auf die Aufgabenerfüllung und wird auch bei einer Dauer über 24 Stunden hinaus von den Betroffenen toleriert.",
    },
    high: {
      C: "Die Vertraulichkeit der Informationen ist Grundlage der Aufgabenerfüllung; die Kenntnisnahme durch Unbefugte hat erhebliche Auswirkungen auf die Aufgabenerfüllung und wird von einzelnen Betroffenen als nicht tolerierbar eingeschätzt.",
      I: "Die Verfälschung/Manipulation der Informationen hat erhebliche Auswirkungen auf die Aufgabenerfüllung und wird von einzelnen Betroffenen als nicht tolerierbar eingeschätzt.",
      A: "Die Nichtverfügbarkeit der Informationen hat erhebliche Auswirkungen auf die Aufgabenerfüllung und kann nur bei einer Dauer zwischen einer und 24 Stunden von den Betroffenen toleriert werden.",
    },
    veryHigh: {
      C: "Die Vertraulichkeit der Informationen ist Grundlage der Aufgabenerfüllung; die Kenntnisnahme durch Unbefugte hat fundamentale Auswirkungen auf die Aufgabenerfüllung und wird von allen Betroffenen als nicht tolerierbar eingeschätzt.",
      I: "Die Verfälschung/Manipulation der Informationen hat fundamentale Auswirkungen auf die Aufgabenerfüllung und wird von allen Betroffenen als nicht tolerierbar eingeschätzt.",
      A: "Die Nichtverfügbarkeit der Informationen hat fundamentale Auswirkungen auf die Aufgabenerfüllung und kann nur bis zu einer Dauer von 1 Stunde von den Betroffenen toleriert werden.",
    },
  },
  {
    scenario: "reputation",
    normal: {
      C: "Es erfolgt keine Verarbeitung von schutzbedürftigen Informationen oder die Kenntnisnahme der Informationen durch Unbefugte führt zu einer geringen bzw. nur ressortinternen Ansehens-/Vertrauensbeeinträchtigung.",
      I: "Es erfolgt keine Verarbeitung von schutzbedürftigen Informationen oder die Verfälschung/Manipulation der Informationen führt zu einer geringen bzw. nur ressortinternen Ansehens-/Vertrauensbeeinträchtigung.",
      A: "Es erfolgt keine Verarbeitung von schutzbedürftigen Informationen oder die Nichtverfügbarkeit der Informationen führt zu einer geringen bzw. nur ressortinternen Ansehens-/Vertrauensbeeinträchtigung.",
    },
    high: {
      C: "Die Kenntnisnahme der Informationen durch Unbefugte führt zu einer erheblichen Ansehens-/Vertrauensbeeinträchtigung auch außerhalb des Ressorts.",
      I: "Die Verfälschung/Manipulation der Informationen führt zu einer erheblichen Ansehens-/Vertrauensbeeinträchtigung auch außerhalb des Ressorts.",
      A: "Die Nichtverfügbarkeit der Informationen führt zu einer erheblichen Ansehens-/Vertrauensbeeinträchtigung auch außerhalb des Ressorts.",
    },
    veryHigh: {
      C: "Die Kenntnisnahme der Informationen durch Unbefugte führt zu einer dauerhaften Ansehens-/Vertrauensbeeinträchtigung außerhalb des Ressorts, ggf. sogar auf internationaler Ebene.",
      I: "Die Verfälschung/Manipulation der Informationen führt zu einer dauerhaften Ansehens-/Vertrauensbeeinträchtigung außerhalb des Ressorts, ggf. sogar auf internationaler Ebene.",
      A: "Die Nichtverfügbarkeit der Informationen führt zu einer dauerhaften Ansehens-/Vertrauensbeeinträchtigung außerhalb des Ressorts, ggf. sogar auf internationaler Ebene.",
    },
  },
  {
    scenario: "financial",
    normal: {
      C: "Es erfolgt keine Verarbeitung von schutzbedürftigen Informationen oder die Kenntnisnahme der Informationen durch Unbefugte hat geringfügige finanzielle Auswirkungen (Schaden unter 1.000.000 €).",
      I: "Es erfolgt keine Verarbeitung von schutzbedürftigen Informationen oder die Verfälschung/Manipulation der Informationen hat geringfügige finanzielle Auswirkungen (Schaden unter 1.000.000 €).",
      A: "Es erfolgt keine Verarbeitung von schutzbedürftigen Informationen oder die Nichtverfügbarkeit der Informationen hat geringfügige finanzielle Auswirkungen (Schaden unter 1.000.000 €).",
    },
    high: {
      C: "Die Kenntnisnahme der Informationen durch Unbefugte hat erhebliche finanzielle Auswirkungen (Schaden über 1.000.000 €).",
      I: "Die Verfälschung/Manipulation der Informationen hat erhebliche finanzielle Auswirkungen (Schaden über 1.000.000 €).",
      A: "Die Nichtverfügbarkeit der Informationen hat erhebliche finanzielle Auswirkungen (Schaden über 1.000.000 €).",
    },
    veryHigh: {
      C: "Die Kenntnisnahme der Informationen durch Unbefugte hat fundamentale finanzielle Auswirkungen (Schaden über 10.000.000 €).",
      I: "Die Verfälschung/Manipulation der Informationen hat fundamentale finanzielle Auswirkungen (Schaden über 10.000.000 €).",
      A: "Die Nichtverfügbarkeit der Informationen hat fundamentale finanzielle Auswirkungen (Schaden über 10.000.000 €).",
    },
  },
];
