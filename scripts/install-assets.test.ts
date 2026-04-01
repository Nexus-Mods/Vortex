import { describe, expect, it } from "vitest";

import installAssets from "../InstallAssets.json";

describe("InstallAssets Cyberpunk helper packaging", () => {
  it("copies the Cyberpunk archive helper executables to out and dist", () => {
    const copyEntries = installAssets.copy.filter((entry) =>
      String(entry.srcPath).includes("cp77-archive-helper"),
    );

    expect(copyEntries).toHaveLength(3);
    expect(copyEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          srcPath: "assets/cp77-archive-helper.exe",
          outPath: "",
          target: ["out", "dist"],
        }),
        expect.objectContaining({
          srcPath: "assets/cp77-archive-helper",
          outPath: "",
          target: ["out", "dist"],
        }),
        expect.objectContaining({
          srcPath: "assets/cp77-archive-helper/**",
          outPath: "",
          skipPaths: 1,
          target: ["out", "dist"],
        }),
      ]),
    );
  });
});
