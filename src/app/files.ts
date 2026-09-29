import { repo } from "../db/repo";
import type { AssessmentVersion } from "../domain/types";
import { versionLabel } from "../domain/versioning";
import { buildBundle, encodeBundle, FILE_SUFFIX, type Bundle } from "../io/json";

export function saveBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

function slug(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ß/g, "ss")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "asset"
  );
}

export function baseName(v: AssessmentVersion): string {
  return `SBA_${slug(v.meta.name)}_v${versionLabel(v)}`;
}

/** The stored state of a version; names entered just before an export are already applied there. */
function fresh(v: AssessmentVersion, stored: AssessmentVersion[]): AssessmentVersion {
  return stored.find((x) => x.id === v.id) ?? v;
}

export async function exportXlsx(v: AssessmentVersion) {
  const [{ exportVersionXlsx }, records, settings] = await Promise.all([
    import("../io/xlsx/export"),
    repo.exportRecords([v.assetId]),
    repo.getSettings(),
  ]);
  const r = records[0]!;
  const data = await exportVersionXlsx(fresh(v, r.versions), r.versions, r.audit, settings);
  saveBlob(
    `${baseName(v)}.xlsx`,
    new Blob([data as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
}

/** OpenDocument spreadsheet for LibreOffice, Collabora and openDesk. */
export async function exportOds(v: AssessmentVersion) {
  const [{ exportVersionOds }, records, settings] = await Promise.all([
    import("../io/ods/export"),
    repo.exportRecords([v.assetId]),
    repo.getSettings(),
  ]);
  const r = records[0]!;
  const data = await exportVersionOds(fresh(v, r.versions), r.versions, r.audit, settings);
  saveBlob(`${baseName(v)}.ods`, new Blob([data as BlobPart], { type: "application/vnd.oasis.opendocument.spreadsheet" }));
}

export async function exportPdf(v: AssessmentVersion) {
  const [{ renderReportPdf }, history, settings] = await Promise.all([
    import("../io/pdf/report"),
    repo.versionsOf(v.assetId),
    repo.getSettings(),
  ]);
  saveBlob(`${baseName(v)}.pdf`, await renderReportPdf(fresh(v, history), history, { settings }));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function saveJson(name: string, bundle: Bundle) {
  // octet-stream keeps browsers from transparently unpacking the gzip payload.
  saveBlob(`${name}${FILE_SUFFIX}`, new Blob([(await encodeBundle(bundle)) as BlobPart], { type: "application/octet-stream" }));
}

/** Settings only (scheme, organization, measures) – to share with colleagues. */
export async function exportSettings(exportedBy: string) {
  await saveJson(`SBA_Einstellungen_${today()}`, buildBundle({ settings: await repo.getSettings() }, exportedBy));
}

/** Settings plus every analysis with all versions and the change log. */
export async function exportBackup(exportedBy: string) {
  const [settings, assets] = await Promise.all([repo.getSettings(), repo.exportRecords()]);
  await saveJson(`SBA_Alle_Analysen_${today()}`, buildBundle({ settings, assets }, exportedBy));
  await repo.markBackup();
}

/** One analysis with all versions and its change log. */
export async function exportAssessment(v: AssessmentVersion, exportedBy: string) {
  await saveJson(baseName(v), buildBundle({ assets: await repo.exportRecords([v.assetId]) }, exportedBy));
}
