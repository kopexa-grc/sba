import { repo } from "../db/repo";
import type { AssessmentVersion } from "../domain/types";
import { verifyIntegrity, versionLabel } from "../domain/versioning";
import { buildBundle, FILE_SUFFIX } from "../io/json";

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

export async function exportXlsx(v: AssessmentVersion) {
  const [{ exportVersionXlsx }, records] = await Promise.all([import("../io/xlsx/export"), repo.exportRecords([v.assetId])]);
  const r = records[0]!;
  const data = await exportVersionXlsx(v, r.versions, r.audit);
  saveBlob(
    `${baseName(v)}.xlsx`,
    new Blob([data as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
}

export async function exportPdf(v: AssessmentVersion) {
  const [{ renderReportPdf }, history, integrity] = await Promise.all([
    import("../io/pdf/report"),
    repo.versionsOf(v.assetId),
    verifyIntegrity(v),
  ]);
  saveBlob(`${baseName(v)}.pdf`, await renderReportPdf(v, history, { integrity }));
}

export async function exportJson(assetIds: string[] | undefined, exportedBy: string, name: string) {
  const bundle = buildBundle(await repo.exportRecords(assetIds), exportedBy);
  saveBlob(`${name}${FILE_SUFFIX}`, new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
}
