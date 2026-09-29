import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { CATALOG } from "../domain/catalog";
import type { Goal } from "../domain/types";
import { WorkflowError } from "../domain/versioning";
import { buildBundle, encodeBundle, parseBundle, readBundleFile } from "../io/json";
import { SbaDatabase } from "./db";
import { Repo } from "./repo";

let d: SbaDatabase;
let repo: Repo;

beforeEach(async () => {
  d = new SbaDatabase(`test-${crypto.randomUUID()}`);
  repo = new Repo(d);
});

async function readyDraft() {
  const v = await repo.createAsset("alice", { name: "CRM", owner: "Vertrieb" });
  await repo.updateDraft(v.id, "alice", (x) => {
    for (const g of ["C", "I", "A"] as Goal[]) {
      for (const s of CATALOG[g].scenarios) x.answers[g][s.id] = { applies: false, level: null, notes: "", explanation: "" };
    }
  });
  return v;
}

describe("repo", () => {
  it("logs every field change of a draft", async () => {
    const v = await repo.createAsset("alice");
    await repo.updateDraft(v.id, "alice", (x) => {
      x.meta.name = "SAP";
      x.answers.C.legal = { applies: true, level: 2, notes: "", explanation: "NDA" };
    });
    const log = await d.audit.where("versionId").equals(v.id).toArray();
    const fields = log.map((l) => l.field);
    expect(fields).toContain("Asset-Bezeichnung");
    expect(fields).toContain("Vertraulichkeit · Gesetze & Verträge");
    expect(log.find((l) => l.field === "Vertraulichkeit · Gesetze & Verträge")).toMatchObject({
      oldValue: null,
      newValue: "Hoch",
    });
  });

  it("requires a reason when an existing rating changes", async () => {
    const v = await repo.createAsset("alice");
    const set = (level: 1 | 2 | 3) => (x: typeof v) => {
      x.answers.C.legal = { applies: true, level, notes: "", explanation: "x" };
    };
    await repo.updateDraft(v.id, "alice", set(1));
    await expect(repo.updateDraft(v.id, "alice", set(3))).rejects.toThrow(WorkflowError);
    await repo.updateDraft(v.id, "alice", set(3), "Gesundheitsdaten nach Art. 9 DSGVO");
    const entry = (await d.audit.toArray()).find((l) => l.newValue === "Sehr hoch");
    expect(entry).toMatchObject({ oldValue: "Normal", reason: "Gesundheitsdaten nach Art. 9 DSGVO" });
  });

  it("closes versions, locks them and branches new drafts", async () => {
    const empty = await repo.createAsset("alice", { name: "Leer" });
    await expect(repo.close(empty.id, "alice")).rejects.toThrow(WorkflowError);

    const v = await readyDraft();
    await repo.close(v.id, "alice");
    await expect(repo.updateDraft(v.id, "alice", (x) => void (x.meta.name = "X"))).rejects.toThrow(WorkflowError);

    const next = await repo.branch(v.id, "alice", "minor", "Rezertifizierung 2027");
    await expect(repo.branch(v.id, "alice", "minor", "zweiter")).rejects.toThrow(WorkflowError);
    expect((await d.assets.get(v.assetId))?.latestVersionId).toBe(next.id);
    expect((await d.audit.where("versionId").equals(v.id).toArray()).map((a) => a.action)).toContain("close");
  });

  it("uses the current scheme for new analyses and versions", async () => {
    const settings = await repo.getSettings();
    const saved = await repo.saveSettings({ ...settings, scheme: { ...settings.scheme, financialHigh: 50_000, financialVeryHigh: 500_000 } });
    expect(saved.scheme.revision).toBe(settings.scheme.revision + 1);
    // Saving unchanged thresholds keeps the revision.
    expect((await repo.saveSettings({ ...saved, organization: { name: "ACME", logo: null } })).scheme.revision).toBe(saved.scheme.revision);
    const v = await repo.createAsset("alice");
    expect(v.scheme).toMatchObject({ financialHigh: 50_000, revision: saved.scheme.revision });
  });

  it("requires a reason when a branched version re-rates via an open intermediate state", async () => {
    const v = await readyDraft();
    await repo.close(v.id, "alice");
    const next = await repo.branch(v.id, "alice", "minor", "Rezertifizierung");
    // Normal -> open (no reason needed for the intermediate step) ...
    await repo.updateDraft(next.id, "alice", (x) => {
      x.answers.I.financial = { applies: true, level: null, notes: "", explanation: "" };
    });
    // ... -> Hoch differs from the closed baseline and needs a reason.
    const toHigh = (x: typeof v) => {
      x.answers.I.financial = { applies: true, level: 2, notes: "", explanation: "x" };
    };
    expect(await repo.previewReclassifications(next.id, toHigh)).toMatchObject([
      { path: "I.financial", oldValue: "Normal", newValue: "Hoch" },
    ]);
    await expect(repo.updateDraft(next.id, "alice", toHigh)).rejects.toThrow(WorkflowError);
    await repo.updateDraft(next.id, "alice", toHigh, "Neuer Großkundenvertrag");
  });

  it("round-trips settings and analyses through one backup file", async () => {
    const v = await readyDraft();
    await repo.close(v.id, "alice");
    // A tiny PNG as data URL, as produced by the logo upload.
    const logo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const settings = await repo.saveSettings({ ...(await repo.getSettings()), organization: { name: "ACME GmbH", logo } });
    const bundle = buildBundle({ settings, assets: await repo.exportRecords() });
    expect(bundle.kind).toBe("backup");
    const file = await encodeBundle(bundle);
    expect([file[0], file[1]]).toEqual([0x1f, 0x8b]);
    expect(file.length).toBeLessThan(JSON.stringify(bundle).length);
    const parsed = await readBundleFile(file);
    // Plain JSON from older exports is still accepted.
    expect((await readBundleFile(new TextEncoder().encode(JSON.stringify(bundle)))).records).toHaveLength(1);
    expect(parsed.settings?.organization.name).toBe("ACME GmbH");
    expect(parsed.settings?.organization.logo).toBe(logo);

    const other = new Repo(new SbaDatabase(`test-${crypto.randomUUID()}`));
    expect(await other.importRecords(parsed.records)).toMatchObject({ assets: 1, versions: 1 });
    expect(await other.importRecords(parsed.records)).toMatchObject({ assets: 0, versions: 0, skipped: 1 });
    await other.saveSettings(parsed.settings!);
    expect((await other.getSettings()).organization.logo).toBe(logo);
  });

  it("migrates files from the former approval workflow", async () => {
    const v = await readyDraft();
    const records = await repo.exportRecords();
    const legacy = {
      schemaVersion: "1.0.0",
      app: "kopexa-sba",
      exportedAt: "2026-09-29T00:00:00.000Z",
      assets: records.map((r) => ({
        asset: r.asset,
        versions: r.versions.map(({ closedAt: _a, closedBy: _b, scheme: _c, ...x }) => ({
          ...x,
          status: "approved",
          submitted: { at: x.updatedAt, by: "alice" },
          approved: { at: "2026-09-29T10:00:00.000Z", by: "ciso" },
          rejections: [],
          hash: "00",
          supersededBy: null,
        })),
        audit: [...r.audit, { ...r.audit[0]!, id: "x", action: "approve" }, { ...r.audit[0]!, id: "y", action: "submit" }],
      })),
    };
    const parsed = await parseBundle(JSON.stringify(legacy));
    expect(parsed.migratedFrom).toBe("1.0.0");
    const migrated = parsed.records[0]!.versions[0]!;
    expect(migrated).toMatchObject({ id: v.id, status: "final", closedBy: "ciso" });
    expect(migrated.scheme.financialHigh).toBe(1_000_000);
    const actions = parsed.records[0]!.audit.map((a) => a.action);
    expect(actions).toContain("close");
    expect(actions).not.toContain("submit");
  });
});

describe("sample", () => {
  it("creates a complete example analysis without blocking issues", async () => {
    const { hasBlockingIssues } = await import("../domain/scoring");
    const v = await repo.createSample("alice");
    expect(v.meta.name).toBe("Beispiel: Kunden-CRM");
    expect(hasBlockingIssues(v)).toBe(false);
    const { validate } = await import("../domain/scoring");
    expect(validate(v)).toEqual([]);
  });
});

describe("change log", () => {
  it("merges consecutive text edits of one field into one entry", async () => {
    const v = await repo.createAsset("alice");
    for (const text of ["Kunden", "Kundendaten", "Kundendaten und Verträge"]) {
      await repo.updateDraft(v.id, "alice", (x) => void (x.meta.description = text));
    }
    const entries = (await d.audit.where("versionId").equals(v.id).toArray()).filter((a) => a.action === "update");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ oldValue: null, newValue: "Kundendaten und Verträge" });

    // Another field in between starts a new entry for the next edit.
    await repo.updateDraft(v.id, "alice", (x) => void (x.meta.owner = "Vertrieb"));
    await repo.updateDraft(v.id, "alice", (x) => void (x.meta.description = "Nur Kundendaten"));
    const after = (await d.audit.where("versionId").equals(v.id).toArray()).filter((a) => a.action === "update");
    expect(after).toHaveLength(3);
  });
});

describe("bulk capture", () => {
  it("creates many analyses and notes the source", async () => {
    const created = await repo.createAssets("alice", [{ name: "CRM", type: "application" }, { name: "Serverraum", type: "room" }], "assets.csv");
    expect(created).toHaveLength(2);
    expect((await repo.assetNames()).sort()).toEqual(["CRM", "Serverraum"]);
    const log = await d.audit.where("assetId").equals(created[1]!.assetId).toArray();
    expect(log.map((a) => a.action).sort()).toEqual(["create", "import"]);
    expect(log.find((a) => a.action === "import")?.newValue).toBe("assets.csv");
  });
});
