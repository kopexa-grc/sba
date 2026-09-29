import { ASSET_TYPE_LABEL, type AssetType } from "./types";

export interface CaptureRow {
  name: string;
  type: AssetType;
  owner: string;
}

export const emptyRow = (type: AssetType = "application"): CaptureRow => ({ name: "", type, owner: "" });

const TYPE_ALIASES: Record<string, AssetType> = {
  anwendung: "application",
  applikation: "application",
  application: "application",
  app: "application",
  software: "application",
  infrastruktur: "infrastructure",
  infrastructure: "infrastructure",
  system: "infrastructure",
  server: "infrastructure",
  netz: "infrastructure",
  netzwerk: "infrastructure",
  informationsverbund: "information-domain",
  "information-domain": "information-domain",
  prozess: "process",
  geschäftsprozess: "process",
  process: "process",
  raum: "room",
  "physischer raum": "room",
  gebäude: "room",
  room: "room",
  // Common terms in asset inventories.
  fachanwendung: "application",
  webanwendung: "application",
  saas: "application",
  "cloud-dienst": "application",
  clouddienst: "application",
  cloud: "application",
  dienst: "application",
  service: "application",
  datenbank: "infrastructure",
  database: "infrastructure",
  "it-system": "infrastructure",
  hardware: "infrastructure",
  client: "infrastructure",
  arbeitsplatz: "infrastructure",
  netzkomponente: "infrastructure",
  network: "infrastructure",
  "information domain": "information-domain",
  verbund: "information-domain",
  prozesse: "process",
  geschäftsprozesse: "process",
  "business process": "process",
  standort: "room",
  rechenzentrum: "room",
  serverraum: "room",
  büro: "room",
  location: "room",
};

/** Maps a free-text type ("Anwendung", "Server", "Prozess" …) to an asset type, or null if unknown. */
export function parseAssetType(text: string): AssetType | null {
  const key = text.trim().toLowerCase();
  if (!key) return null;
  if (TYPE_ALIASES[key]) return TYPE_ALIASES[key]!;
  const byLabel = (Object.entries(ASSET_TYPE_LABEL) as [AssetType, string][]).find(([, l]) => l.toLowerCase() === key);
  return byLabel?.[0] ?? null;
}

/**
 * Turns pasted text into rows: one asset per line; tab-separated columns are
 * name, type and owner (as copied from a spreadsheet). A second column that is
 * no known type is taken as the owner.
 */
export function parsePastedAssets(text: string, defaultType: AssetType = "application"): CaptureRow[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.split("\t").map((c) => c.trim()))
    .filter((cols) => cols[0])
    .map(([name, second = "", third = ""]) => {
      const type = parseAssetType(second);
      if (type) return { name: name!, type, owner: third };
      return { name: name!, type: defaultType, owner: second || third };
    });
}

/** Rows that will be created: non-empty names, trimmed, without duplicates within the batch. */
export function rowsToCreate(rows: CaptureRow[]): CaptureRow[] {
  const seen = new Set<string>();
  const out: CaptureRow[] = [];
  for (const r of rows) {
    const name = r.name.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...r, name, owner: r.owner.trim() });
  }
  return out;
}
