import { diffVersions, reclassifications, type Change } from "../domain/diff";
import type { AssessmentVersion, Asset, AssetMeta, AuditAction, AuditEntry } from "../domain/types";
import { defaultSettings, snapshotOf, type Settings } from "../domain/scheme";
import { hasBlockingIssues } from "../domain/scoring";
import {
  branchVersion,
  closeVersion,
  compareVersions,
  newVersion,
  nowIso,
  uid,
  versionLabel,
  WorkflowError,
} from "../domain/versioning";
import { db, type SbaDatabase } from "./db";

export interface Identity {
  name: string;
  email: string;
}

export function actorLabel(id: Identity): string {
  return id.email ? `${id.name} <${id.email}>` : id.name;
}


export class Repo {
  private readonly d: SbaDatabase;

  constructor(database: SbaDatabase = db) {
    this.d = database;
  }

  async getIdentity(): Promise<Identity | null> {
    const row = await this.d.settings.get("identity");
    return (row?.value as Identity | undefined) ?? null;
  }

  async setIdentity(id: Identity): Promise<void> {
    await this.d.settings.put({ key: "identity", value: id });
  }

  async markBackup(): Promise<void> {
    await this.d.settings.put({ key: "lastBackupAt", value: nowIso() });
  }

  async lastBackupAt(): Promise<string | null> {
    return ((await this.d.settings.get("lastBackupAt"))?.value as string | undefined) ?? null;
  }

  async getSettings(): Promise<Settings> {
    const row = await this.d.settings.get("settings");
    const stored = row?.value as Partial<Settings> | undefined;
    const defaults = defaultSettings();
    return {
      organization: { ...defaults.organization, ...stored?.organization },
      scheme: { ...defaults.scheme, ...stored?.scheme },
      measures: stored?.measures ?? defaults.measures,
    };
  }

  /** Saves settings; any change to the thresholds creates a new scheme revision. */
  async saveSettings(next: Settings): Promise<Settings> {
    const current = await this.getSettings();
    const { revision: _r, updatedAt: _u, ...a } = current.scheme;
    const { revision: _r2, updatedAt: _u2, ...b } = next.scheme;
    const schemeChanged = JSON.stringify(a) !== JSON.stringify(b);
    const saved: Settings = {
      ...next,
      scheme: schemeChanged
        ? { ...next.scheme, revision: current.scheme.revision + 1, updatedAt: nowIso() }
        : current.scheme,
    };
    await this.d.settings.put({ key: "settings", value: saved });
    return saved;
  }

  private entry(
    v: AssessmentVersion,
    actor: string,
    action: AuditAction,
    extra: Partial<Pick<AuditEntry, "field" | "oldValue" | "newValue" | "reason">> = {},
  ): AuditEntry {
    return {
      id: uid(),
      assetId: v.assetId,
      versionId: v.id,
      versionLabel: versionLabel(v),
      at: nowIso(),
      actor,
      action,
      field: null,
      oldValue: null,
      newValue: null,
      reason: null,
      ...extra,
    };
  }

  async createAsset(actor: string, meta: Partial<AssetMeta> = {}): Promise<AssessmentVersion> {
    const assetId = uid();
    const v = newVersion(assetId, actor, meta, snapshotOf((await this.getSettings()).scheme));
    await this.d.transaction("rw", this.d.assets, this.d.versions, this.d.audit, async () => {
      await this.d.assets.add({ id: assetId, createdAt: v.createdAt, latestVersionId: v.id });
      await this.d.versions.add(v);
      await this.d.audit.add(this.entry(v, actor, "create", { newValue: versionLabel(v) }));
    });
    return v;
  }

  async versionsOf(assetId: string): Promise<AssessmentVersion[]> {
    const list = await this.d.versions.where("assetId").equals(assetId).toArray();
    return list.sort(compareVersions);
  }

  private async baseline(v: AssessmentVersion): Promise<AssessmentVersion | null> {
    return v.parentVersionId ? ((await this.d.versions.get(v.parentVersionId)) ?? null) : null;
  }

  /**
   * Applies a mutation to a draft and records one audit entry per changed field.
   * Throws if a rating is changed without a reason.
   */
  async updateDraft(
    versionId: string,
    actor: string,
    mutate: (v: AssessmentVersion) => void,
    reason?: string,
  ): Promise<Change[]> {
    return this.d.transaction("rw", this.d.versions, this.d.audit, async () => {
      const current = await this.d.versions.get(versionId);
      if (!current) throw new WorkflowError("Version nicht gefunden.");
      if (current.status !== "draft") {
        throw new WorkflowError("Diese Version ist schreibgeschützt. Legen Sie eine neue Version an.");
      }
      const next = structuredClone(current);
      mutate(next);
      const changes = diffVersions(current, next);
      if (changes.length === 0) return changes;
      const rerated = reclassifications(current, next, await this.baseline(current));
      if (rerated.length > 0 && !reason?.trim()) {
        throw new WorkflowError("Die Änderung einer Einstufung erfordert einen Änderungsgrund.");
      }
      const reratedPaths = new Set(rerated.map((c) => c.path));
      next.updatedAt = nowIso();
      next.updatedBy = actor;
      await this.d.versions.put(next);
      await this.d.audit.bulkAdd(
        changes.map((c) =>
          this.entry(next, actor, "update", {
            field: c.label,
            oldValue: c.oldValue,
            newValue: c.newValue,
            reason: reratedPaths.has(c.path) || c.isRating ? (reason ?? null) : null,
          }),
        ),
      );
      return changes;
    });
  }

  /** Rating changes an update would make that need a documented reason (asked before saving). */
  async previewReclassifications(versionId: string, mutate: (v: AssessmentVersion) => void): Promise<Change[]> {
    const current = await this.d.versions.get(versionId);
    if (!current) return [];
    const next = structuredClone(current);
    mutate(next);
    return reclassifications(current, next, await this.baseline(current));
  }

  /** Closes a draft; it becomes read-only. Requires all mandatory fields. */
  async close(versionId: string, actor: string): Promise<AssessmentVersion> {
    const current = await this.d.versions.get(versionId);
    if (!current) throw new WorkflowError("Version nicht gefunden.");
    if (hasBlockingIssues(current)) throw new WorkflowError("Vor dem Abschließen fehlen noch Pflichtangaben.");
    const closed = closeVersion(current, actor);
    await this.d.transaction("rw", this.d.versions, this.d.audit, async () => {
      await this.d.versions.put(closed);
      await this.d.audit.add(this.entry(closed, actor, "close", { oldValue: versionLabel(current), newValue: versionLabel(closed) }));
    });
    return closed;
  }

  async branch(versionId: string, actor: string, kind: "minor" | "major", summary: string): Promise<AssessmentVersion> {
    const from = await this.d.versions.get(versionId);
    if (!from) throw new WorkflowError("Version nicht gefunden.");
    if (from.status !== "final") {
      throw new WorkflowError("Neue Versionen entstehen aus einer abgeschlossenen Version.");
    }
    const siblings = await this.versionsOf(from.assetId);
    if (siblings.some((s) => s.status === "draft")) {
      throw new WorkflowError("Für dieses Asset existiert bereits eine offene Arbeitsversion.");
    }
    if (!summary.trim()) throw new WorkflowError("Bitte beschreiben Sie den Anlass der neuen Version.");
    const scheme = snapshotOf((await this.getSettings()).scheme);
    const next = branchVersion(from, siblings, kind, actor, summary, scheme);
    await this.d.transaction("rw", this.d.assets, this.d.versions, this.d.audit, async () => {
      await this.d.versions.add(next);
      await this.d.assets.update(from.assetId, { latestVersionId: next.id });
      await this.d.audit.add(
        this.entry(next, actor, "branch", {
          oldValue: versionLabel(from),
          newValue: versionLabel(next),
          reason: summary,
        }),
      );
    });
    return next;
  }

  /** Discards an unapproved working copy that was branched from an earlier version. */
  async discardDraft(versionId: string, actor: string): Promise<string> {
    const v = await this.d.versions.get(versionId);
    if (!v || v.status !== "draft" || !v.parentVersionId) {
      throw new WorkflowError("Nur abgeleitete Entwürfe können verworfen werden.");
    }
    await this.d.transaction("rw", this.d.assets, this.d.versions, this.d.audit, async () => {
      await this.d.versions.delete(v.id);
      await this.d.assets.update(v.assetId, { latestVersionId: v.parentVersionId! });
      await this.d.audit.add(this.entry(v, actor, "delete-draft", { oldValue: versionLabel(v) }));
    });
    return v.parentVersionId;
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.d.transaction("rw", this.d.assets, this.d.versions, this.d.audit, async () => {
      await this.d.versions.where("assetId").equals(assetId).delete();
      await this.d.audit.where("assetId").equals(assetId).delete();
      await this.d.assets.delete(assetId);
    });
  }

  /**
   * Stores complete assets (all versions and audit entries), e.g. from a JSON
   * backup or an XLSX import. Existing records with the same id are kept.
   */
  async importRecords(
    records: { asset: Asset; versions: AssessmentVersion[]; audit: AuditEntry[] }[],
  ): Promise<{ assets: number; versions: number; skipped: number }> {
    let assets = 0;
    let versions = 0;
    let skipped = 0;
    await this.d.transaction("rw", this.d.assets, this.d.versions, this.d.audit, async () => {
      for (const r of records) {
        if (!(await this.d.assets.get(r.asset.id))) {
          await this.d.assets.add(r.asset);
          assets++;
        }
        for (const v of r.versions) {
          if (await this.d.versions.get(v.id)) {
            skipped++;
            continue;
          }
          await this.d.versions.add(v);
          versions++;
        }
        const existing = new Set((await this.d.audit.where("assetId").equals(r.asset.id).primaryKeys()) as string[]);
        await this.d.audit.bulkAdd(r.audit.filter((a) => !existing.has(a.id)));
        const all = await this.versionsOf(r.asset.id);
        const latest = all[all.length - 1];
        if (latest) await this.d.assets.update(r.asset.id, { latestVersionId: latest.id });
      }
    });
    return { assets, versions, skipped };
  }

  async logImport(v: AssessmentVersion, actor: string, source: string): Promise<void> {
    await this.d.audit.add(this.entry(v, actor, "import", { newValue: source }));
  }

  async exportRecords(assetIds?: string[]) {
    const assets = assetIds ? await this.d.assets.bulkGet(assetIds) : await this.d.assets.toArray();
    return Promise.all(
      assets
        .filter((a): a is Asset => !!a)
        .map(async (asset) => ({
          asset,
          versions: await this.versionsOf(asset.id),
          audit: (await this.d.audit.where("assetId").equals(asset.id).toArray()).sort((a, b) => a.at.localeCompare(b.at)),
        })),
    );
  }
}

export const repo = new Repo();
