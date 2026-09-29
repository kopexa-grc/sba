import { CATALOG, type GoalDef } from "./catalog";
import { DEFINITIONS, type CategoryDefinition } from "./definitions";
import type { Goal } from "./types";

/**
 * Organization-specific rating scheme. BSI 200-2 expects every organization to
 * define its own damage categories; the defaults mirror the reference workbook.
 */
export interface RatingScheme {
  name: string;
  /** Incremented on every change, so analyses can reference the exact state. */
  revision: number;
  updatedAt: string;
  /** Financial damage above this amount (EUR) is "Hoch". */
  financialHigh: number;
  /** Financial damage above this amount (EUR) is "Sehr hoch". */
  financialVeryHigh: number;
  /** Outages up to this many hours are tolerable only for "Hoch"; longer ones are "Normal". */
  availabilityHighHours: number;
  /** Outages tolerable only up to this many hours are "Sehr hoch". */
  availabilityVeryHighHours: number;
}

/** The part of the scheme that is stored with every analysis version. */
export type SchemeSnapshot = Omit<RatingScheme, "updatedAt">;

export interface OrganizationSettings {
  name: string;
  /** Logo as data URL (PNG/JPEG), shown in PDF and Excel reports. */
  logo: string | null;
}

export type MeasureCatalog = Record<Goal, Record<2 | 3, string[]>>;

export interface Settings {
  organization: OrganizationSettings;
  scheme: RatingScheme;
  measures: MeasureCatalog;
}

export const DEFAULT_SCHEME: RatingScheme = {
  name: "Standard (Referenzbogen)",
  revision: 1,
  updatedAt: "2026-09-29T00:00:00.000Z",
  financialHigh: 1_000_000,
  financialVeryHigh: 10_000_000,
  availabilityHighHours: 24,
  availabilityVeryHighHours: 1,
};

export const DEFAULT_MEASURES: MeasureCatalog = {
  C: {
    2: [
      "Rollenbasierte Zugriffskontrolle nach Need-to-know, regelmäßige Rezertifizierung der Berechtigungen",
      "Multi-Faktor-Authentisierung für alle Zugänge",
      "Verschlüsselung bei Übertragung (TLS 1.2+) und Speicherung",
      "Protokollierung und Auswertung von Zugriffen",
    ],
    3: [
      "Starke Verschlüsselung mit kontrolliertem Schlüsselmanagement (HSM/KMS, ggf. BYOK)",
      "Privileged Access Management mit Vier-Augen-Prinzip",
      "Data Loss Prevention und Netzsegmentierung",
      "Datenschutz-Folgenabschätzung (Art. 35 DSGVO) prüfen",
    ],
  },
  I: {
    2: [
      "Änderungs- und Freigabeprozess (Change Management) mit Nachvollziehbarkeit",
      "Integritätsprüfungen (Prüfsummen, Plausibilitätskontrollen) für kritische Daten",
      "Manipulationssichere Protokollierung",
    ],
    3: [
      "Kryptografische Signaturen bzw. Hash-Ketten für kritische Datensätze",
      "Vier-Augen-Prinzip für Änderungen an Daten und Konfiguration",
      "Unveränderliche (WORM) Sicherungen und regelmäßige Wiederherstellungstests",
    ],
  },
  A: {
    2: [
      "Datensicherung nach 3-2-1-Regel, dokumentiertes RTO/RPO",
      "Monitoring und Alarmierung",
      "Notfallhandbuch und Wiederanlaufplan",
    ],
    3: [
      "Redundante, georedundante Auslegung ohne Single Point of Failure",
      "Regelmäßige Notfall- und Wiederanlaufübungen (BCM nach BSI 200-4)",
      "DDoS-Schutz und Ransomware-resiliente, isolierte Sicherungen",
    ],
  },
};

export function defaultSettings(): Settings {
  return {
    organization: { name: "", logo: null },
    scheme: { ...DEFAULT_SCHEME },
    measures: structuredClone(DEFAULT_MEASURES),
  };
}

export function snapshotOf(scheme: RatingScheme): SchemeSnapshot {
  const { updatedAt: _ignored, ...rest } = scheme;
  return rest;
}

export const DEFAULT_SNAPSHOT: SchemeSnapshot = snapshotOf(DEFAULT_SCHEME);

/** Plausibility of a scheme; returns German error messages. */
export function schemeErrors(s: Pick<RatingScheme, "financialHigh" | "financialVeryHigh" | "availabilityHighHours" | "availabilityVeryHighHours">): string[] {
  const errors: string[] = [];
  if (!(s.financialHigh > 0)) errors.push("Der Betrag für „Hoch“ muss größer als 0 sein.");
  if (!(s.financialVeryHigh > s.financialHigh)) errors.push("Der Betrag für „Sehr hoch“ muss größer sein als für „Hoch“.");
  if (!(s.availabilityVeryHighHours > 0)) errors.push("Die Ausfallzeit für „Sehr hoch“ muss größer als 0 sein.");
  if (!(s.availabilityHighHours > s.availabilityVeryHighHours)) {
    errors.push("Die tolerierbare Ausfallzeit für „Hoch“ muss länger sein als für „Sehr hoch“.");
  }
  return errors;
}

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

export function formatEuro(amount: number): string {
  return euro.format(amount);
}

export function formatHours(hours: number): string {
  const n = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(hours);
  return `${n} ${hours === 1 ? "Stunde" : "Stunden"}`;
}

/** Question catalog with the scheme's thresholds filled into the option texts. */
export function catalogFor(scheme: SchemeSnapshot): Record<Goal, GoalDef> {
  const high = formatEuro(scheme.financialHigh);
  const veryHigh = formatEuro(scheme.financialVeryHigh);
  const h = formatHours(scheme.availabilityHighHours);
  const vh = formatHours(scheme.availabilityVeryHighHours);
  const financial = [
    `einem finanziellen Schaden von weniger als ${high}`,
    `einem finanziellen Schaden von mehr als ${high}`,
    `einem finanziellen Schaden von mehr als ${veryHigh}`,
  ];
  const operationsA = [
    `geringfügige Auswirkungen auf die Aufgabenerfüllung und wird auch bei einer Dauer über ${h} hinaus von den Betroffenen toleriert`,
    `erhebliche Auswirkungen auf die Aufgabenerfüllung und kann nur bei einer Dauer zwischen ${vh} und ${h} von den Betroffenen toleriert werden`,
    `fundamentale Auswirkungen auf die Aufgabenerfüllung und kann nur bis zu einer Dauer von ${vh} von den Betroffenen toleriert werden`,
  ];
  const out = structuredClone(CATALOG);
  for (const goal of ["C", "I", "A"] as Goal[]) {
    for (const s of out[goal].scenarios) {
      if (s.id === "financial") s.options = s.options.map((o, i) => ({ ...o, text: financial[i]! }));
      if (goal === "A" && s.id === "operations") s.options = s.options.map((o, i) => ({ ...o, text: operationsA[i]! }));
    }
  }
  return out;
}

/** Category definitions with the scheme's thresholds. */
export function definitionsFor(scheme: SchemeSnapshot): CategoryDefinition[] {
  const high = formatEuro(scheme.financialHigh);
  const veryHigh = formatEuro(scheme.financialVeryHigh);
  const h = formatHours(scheme.availabilityHighHours);
  const vh = formatHours(scheme.availabilityVeryHighHours);
  return DEFINITIONS.map((d) => {
    const c = structuredClone(d);
    if (d.scenario === "financial") {
      for (const g of ["C", "I", "A"] as Goal[]) {
        c.normal[g] = d.normal[g].replace("unter 1.000.000 €", `unter ${high}`);
        c.high[g] = d.high[g].replace("über 1.000.000 €", `über ${high}`);
        c.veryHigh[g] = d.veryHigh[g].replace("über 10.000.000 €", `über ${veryHigh}`);
      }
    }
    if (d.scenario === "operations") {
      c.normal.A = d.normal.A.replace("über 24 Stunden", `über ${h}`);
      c.high.A = d.high.A.replace("zwischen einer und 24 Stunden", `zwischen ${vh} und ${h}`);
      c.veryHigh.A = d.veryHigh.A.replace("bis zu einer Dauer von 1 Stunde", `bis zu einer Dauer von ${vh}`);
    }
    return c;
  });
}

/** Human-readable summary of a scheme, e.g. for reports. */
export function describeScheme(s: SchemeSnapshot): string {
  return `${s.name} (Stand ${s.revision}): Finanzieller Schaden hoch ab ${formatEuro(s.financialHigh)}, sehr hoch ab ${formatEuro(
    s.financialVeryHigh,
  )}; tolerierbarer Ausfall hoch bis ${formatHours(s.availabilityHighHours)}, sehr hoch bis ${formatHours(s.availabilityVeryHighHours)}.`;
}
