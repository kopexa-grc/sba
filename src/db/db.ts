import Dexie, { type EntityTable } from "dexie";
import { DEFAULT_SNAPSHOT } from "../domain/scheme";
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
    // v2: the review/approval workflow and the seal were removed; versions are
    // either drafts or closed by their author and carry a rating scheme.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table("versions")
          .toCollection()
          .modify((v: Record<string, unknown>) => {
            const approved = v.approved as { at: string; by: string } | null | undefined;
            const final = v.status === "approved" || v.status === "archived";
            v.status = final ? "final" : "draft";
            v.closedAt = final ? (approved?.at ?? v.updatedAt) : null;
            v.closedBy = final ? (approved?.by ?? v.updatedBy) : null;
            v.scheme ??= DEFAULT_SNAPSHOT;
            for (const k of ["submitted", "approved", "rejections", "hash", "supersededBy"]) delete v[k];
          });
        await tx
          .table("audit")
          .toCollection()
          .modify((a: Record<string, unknown>) => {
            if (a.action === "approve") a.action = "close";
            else if (["submit", "reject", "supersede", "archive"].includes(a.action as string)) {
              a.field ??= `Prüfschritt (${a.action})`;
              a.action = "update";
            }
          });
      });
  }
}

export const db = new SbaDatabase();
