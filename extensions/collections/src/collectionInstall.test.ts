import { describe, expect, it } from "vitest";

import { testSupported } from "./collectionInstall";

// ---------------------------------------------------------------------------
// testSupported
// ---------------------------------------------------------------------------

describe("testSupported", () => {
  it("returns supported=true when collection.json is in the file list", async () => {
    const files = ["collection.json", "readme.txt", "bundled/mod.zip"];
    const result = await testSupported(files, "skyrimse");

    expect(result.supported).toBe(true);
    expect(result.requiredFiles).toContain("collection.json");
  });

  it("returns supported=false when collection.json is absent", async () => {
    const files = ["readme.txt", "mod.esp", "textures/file.dds"];
    const result = await testSupported(files, "skyrimse");

    expect(result.supported).toBe(false);
  });

  it("returns supported=false for an empty file list", async () => {
    const result = await testSupported([], "skyrimse");

    expect(result.supported).toBe(false);
  });

  it("is case-sensitive (Collection.json is not collection.json)", async () => {
    const files = ["Collection.json"];
    const result = await testSupported(files, "skyrimse");

    expect(result.supported).toBe(false);
  });

  it("does not match collection.json in a subdirectory", async () => {
    const files = ["subdir/collection.json"];
    const result = await testSupported(files, "skyrimse");

    expect(result.supported).toBe(false);
  });

  it("always lists collection.json as required", async () => {
    const result = await testSupported(["anything"], "skyrimse");

    expect(result.requiredFiles).toEqual(["collection.json"]);
  });
});
