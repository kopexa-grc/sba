import type { Goal } from "./types";

/**
 * Typical safeguards per goal and level (phase 4 of the method: deriving measures).
 * These are suggestions for follow-up in the ISMS, not a complete control catalogue.
 */
export const MEASURES: Record<Goal, Record<2 | 3, string[]>> = {
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
      "Datensicherung nach 3-2-1-Regel, dokumentiertes RTO/RPO (≤ 24 h)",
      "Monitoring und Alarmierung",
      "Notfallhandbuch und Wiederanlaufplan",
    ],
    3: [
      "Redundante, georedundante Auslegung ohne Single Point of Failure (RTO ≤ 1 h)",
      "Regelmäßige Notfall- und Wiederanlaufübungen (BCM nach BSI 200-4)",
      "DDoS-Schutz und Ransomware-resiliente, isolierte Sicherungen",
    ],
  },
};
