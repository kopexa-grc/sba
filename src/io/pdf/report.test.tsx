// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sampleSettings, sampleVersions } from "./fixtures";
import { renderReportBuffer } from "./report";

function pageCount(buf: Uint8Array): number {
  const text = Buffer.from(buf).toString("latin1");
  return (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

describe("PDF executive report", () => {
  it("renders a closed version on three pages", async () => {
    const { final } = await sampleVersions();
    const buf = await renderReportBuffer(final, [final], { settings: sampleSettings() });
    expect(Buffer.from(buf.subarray(0, 4)).toString("latin1")).toBe("%PDF");
    expect(pageCount(buf)).toBe(3);
  });

  it("renders without settings", async () => {
    const { final } = await sampleVersions();
    expect(pageCount(await renderReportBuffer(final, [final]))).toBe(3);
  });

  it("renders a draft with open issues", async () => {
    const { draft, history } = await sampleVersions();
    const buf = await renderReportBuffer(draft, history, { settings: sampleSettings() });
    expect(Buffer.from(buf.subarray(0, 4)).toString("latin1")).toBe("%PDF");
    // More high-rated scenarios; the justifications may flow onto a fourth page.
    expect(pageCount(buf)).toBeGreaterThanOrEqual(3);
    expect(pageCount(buf)).toBeLessThanOrEqual(4);
  });
});
