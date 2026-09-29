// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sampleSettings, sampleVersions } from "./fixtures";
import { renderReportBuffer } from "./report";

function pageCount(buf: Uint8Array): number {
  const text = Buffer.from(buf).toString("latin1");
  return (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

describe("PDF executive report", () => {
  // Fixed structure: summary · justifications (may flow) · next steps & measures · sign-off · appendix.
  it("renders a closed version with dedicated sign-off and appendix pages", async () => {
    const { final } = await sampleVersions();
    const buf = await renderReportBuffer(final, [final], { settings: sampleSettings() });
    expect(Buffer.from(buf.subarray(0, 4)).toString("latin1")).toBe("%PDF");
    expect(pageCount(buf)).toBe(5);
  });

  it("renders without settings", async () => {
    const { final } = await sampleVersions();
    expect(pageCount(await renderReportBuffer(final, [final]))).toBe(5);
  });

  it("renders a draft with open issues", async () => {
    const { draft, history } = await sampleVersions();
    const buf = await renderReportBuffer(draft, history, { settings: sampleSettings() });
    expect(Buffer.from(buf.subarray(0, 4)).toString("latin1")).toBe("%PDF");
    // More high-rated scenarios; the justifications may flow onto an extra page.
    expect(pageCount(buf)).toBeGreaterThanOrEqual(5);
    expect(pageCount(buf)).toBeLessThanOrEqual(6);
  });
});
