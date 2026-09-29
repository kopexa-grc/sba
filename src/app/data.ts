import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "../db/db";
import type { AssessmentVersion, AuditEntry } from "../domain/types";
import { compareVersions, verifyIntegrity, type IntegrityState } from "../domain/versioning";

export interface AssetRow {
  assetId: string;
  latest: AssessmentVersion;
  /** Newest approved (valid) version, if any. */
  approved: AssessmentVersion | null;
  versionCount: number;
}

export function useAssetList(): AssetRow[] | undefined {
  return useLiveQuery(async () => {
    const [assets, versions] = await Promise.all([db.assets.toArray(), db.versions.toArray()]);
    const byAsset = new Map<string, AssessmentVersion[]>();
    for (const v of versions) byAsset.set(v.assetId, [...(byAsset.get(v.assetId) ?? []), v]);
    return assets
      .map((a) => {
        const list = (byAsset.get(a.id) ?? []).sort(compareVersions);
        const latest = list.find((v) => v.id === a.latestVersionId) ?? list[list.length - 1];
        if (!latest) return null;
        return {
          assetId: a.id,
          latest,
          approved: [...list].reverse().find((v) => v.status === "approved") ?? null,
          versionCount: list.length,
        };
      })
      .filter((r): r is AssetRow => r !== null)
      .sort((x, y) => y.latest.updatedAt.localeCompare(x.latest.updatedAt));
  });
}

export function useVersion(versionId: string | undefined) {
  return useLiveQuery(() => (versionId ? db.versions.get(versionId) : undefined), [versionId]);
}

export function useVersions(assetId: string | undefined): AssessmentVersion[] | undefined {
  return useLiveQuery(
    async () => (assetId ? (await db.versions.where("assetId").equals(assetId).toArray()).sort(compareVersions) : []),
    [assetId],
  );
}

export function useAudit(assetId: string | undefined): AuditEntry[] | undefined {
  return useLiveQuery(
    async () =>
      assetId ? (await db.audit.where("assetId").equals(assetId).toArray()).sort((a, b) => b.at.localeCompare(a.at)) : [],
    [assetId],
  );
}

export function useIntegrity(version: AssessmentVersion | undefined): IntegrityState {
  const [state, setState] = useState<IntegrityState>("unsealed");
  useEffect(() => {
    let alive = true;
    if (!version) return;
    verifyIntegrity(version).then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, [version]);
  return state;
}
