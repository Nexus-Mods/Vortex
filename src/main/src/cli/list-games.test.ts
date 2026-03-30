import { describe, expect, it } from "vitest";

import { formatTable } from "./list-games";

describe("formatTable", () => {
  it("prints store id, name, and install path columns", () => {
    const output = formatTable([
      {
        store_type: "steam",
        store_id: "489830",
        install_path: "C:/Games/Skyrim Special Edition",
        name: "Skyrim Special Edition",
        store_metadata: null,
      },
    ]);

    expect(output).toContain("STORE");
    expect(output).toContain("ID");
    expect(output).toContain("NAME");
    expect(output).toContain("INSTALL PATH");
    expect(output).toContain("steam");
    expect(output).toContain("489830");
    expect(output).toContain("Skyrim Special Edition");
    expect(output).toContain("C:/Games/Skyrim Special Edition");
  });
});
