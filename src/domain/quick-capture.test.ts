import { describe, expect, it } from "vitest";
import { parseAssetType, parsePastedAssets, rowsToCreate } from "./quick-capture";

describe("quick capture", () => {
  it("recognizes asset types by label and common aliases", () => {
    expect(parseAssetType("Anwendung")).toBe("application");
    expect(parseAssetType(" server ")).toBe("infrastructure");
    expect(parseAssetType("Physischer Raum")).toBe("room");
    expect(parseAssetType("Vertrieb")).toBeNull();
  });

  it("splits pasted lines and spreadsheet columns", () => {
    const rows = parsePastedAssets("Kunden-CRM\tAnwendung\tVertrieb\r\nMailserver\tServer\tIT\nLohnabrechnung\tHR\n\n", "process");
    expect(rows).toEqual([
      { name: "Kunden-CRM", type: "application", owner: "Vertrieb" },
      { name: "Mailserver", type: "infrastructure", owner: "IT" },
      // Unknown second column: default type, taken as owner.
      { name: "Lohnabrechnung", type: "process", owner: "HR" },
    ]);
  });

  it("creates only named, unique rows", () => {
    const rows = rowsToCreate([
      { name: " CRM ", type: "application", owner: " Vertrieb " },
      { name: "crm", type: "application", owner: "" },
      { name: "", type: "room", owner: "x" },
      { name: "Serverraum", type: "room", owner: "" },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["CRM", "Serverraum"]);
    expect(rows[0]!.owner).toBe("Vertrieb");
  });
});
