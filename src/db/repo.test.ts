import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { CATALOG } from "../domain/catalog";
import type { Goal } from "../domain/types";
import { WorkflowError } from "../domain/versioning";
import { buildBundle, parseBundle } from "../io/json";
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

  it("locks approved versions and supersedes them on the next approval", async () => {
    const v = await readyDraft();
    await repo.submit(v.id, "alice");
    await expect(repo.updateDraft(v.id, "alice", (x) => void (x.meta.name = "X"))).rejects.toThrow(WorkflowError);
    const approved = await repo.approve(v.id, "ciso");
    expect(approved.hash).toBeTruthy();

    const next = await repo.branch(v.id, "alice", "minor", "Rezertifizierung 2027");
    await expect(repo.branch(v.id, "alice", "minor", "zweiter")).rejects.toThrow(WorkflowError);
    expect((await d.assets.get(v.assetId))?.latestVersionId).toBe(next.id);

    await repo.submit(next.id, "alice");
    await repo.approve(next.id, "ciso");
    const old = await d.versions.get(v.id);
    expect(old?.status).toBe("archived");
    expect(old?.supersededBy).toBe(next.id);
  });

  it("round-trips through the JSON bundle", async () => {
    const v = await readyDraft();
    await repo.submit(v.id, "alice");
    await repo.approve(v.id, "ciso");
    const bundle = buildBundle(await repo.exportRecords());
    const parsed = await parseBundle(JSON.stringify(bundle));
    expect(parsed.tampered).toEqual([]);

    const other = new Repo(new SbaDatabase(`test-${crypto.randomUUID()}`));
    expect(await other.importRecords(parsed.records)).toMatchObject({ assets: 1, versions: 1 });
    expect(await other.importRecords(parsed.records)).toMatchObject({ assets: 0, versions: 0, skipped: 1 });

    bundle.assets[0]!.versions[0]!.meta.owner = "Manipuliert";
    expect((await parseBundle(JSON.stringify(bundle))).tampered).toHaveLength(1);
  });
});
