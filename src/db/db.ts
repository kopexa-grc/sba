import Dexie, { type EntityTable } from "dexie";
import type { AssessmentVersion, Asset, AuditEntry } from "../domain/types";

export interface Setting {
  key: string;
  value: unknown;
}

export class SbaDatabase extends Dexie {
  assets!: EntityTable<Asset, "id">;
  versions!: EntityTable<AssessmentVersion, "id">;
  audit!: EntityTable<AuditEntry, "id">;
  settings!: EntityTable<Setting, "key">;

  constructor(name = "kopexa-sba") {
    super(name);
    this.version(1).stores({
      assets: "id, createdAt",
      versions: "id, assetId, status, updatedAt",
      audit: "id, assetId, versionId, at",
      settings: "key",
    });
  }
}

export const db = new SbaDatabase();
