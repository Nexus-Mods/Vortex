import { describe, expect, it } from "vitest";

import { issueTypeForCheck, resolutionTypeForCategory } from "./tracking";

describe("issueTypeForCheck", () => {
  it("maps the file-level check to warning", () => {
    expect(issueTypeForCheck("check-file-level-requirements")).toBe("warning");
  });

  it("maps the mod-level check to suggestion", () => {
    expect(issueTypeForCheck("check-nexus-mod-requirements")).toBe("suggestion");
  });
});

describe("resolutionTypeForCategory", () => {
  it.each([
    ["download", "install"],
    ["install-uninstalled", "install"],
    ["toggle", "enable"],
    ["or", "pick"],
    ["download-replace", "update"],
  ] as const)("maps %s to %s", (category, expected) => {
    expect(resolutionTypeForCategory(category)).toBe(expected);
  });
});
