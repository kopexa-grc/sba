// @vitest-environment node
import { describe, expect, it } from "vitest";
import { sampleVersions } from "./fixtures";
import { renderReportBuffer } from "./report";

function pageCount(buf: Uint8Array): number {
  const text = Buffer.from(buf).toString("latin1");
  return (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

describe("PDF executive report", () => {
  it("renders an approved version on three pages", async () => {
    const { approved } = await sampleVersions();
    const buf = await renderReportBuffer(approved, [approved], { integrity: "valid" });
    expect(Buffer.from(buf.subarray(0, 4)).toString("latin1")).toBe("%PDF");
    expect(pageCount(buf)).toBe(3);
  });

  it("renders a draft with open issues", async () => {
    const { draft, history } = await sampleVersions();
    const buf = await renderReportBuffer(draft, history);
    expect(Buffer.from(buf.subarray(0, 4)).toString("latin1")).toBe("%PDF");
    expect(pageCount(buf)).toBe(3);
  });
});
