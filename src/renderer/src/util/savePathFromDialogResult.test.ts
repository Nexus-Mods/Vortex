import { describe, expect, it } from "vitest";

import { savePathFromDialogResult } from "./savePathFromDialogResult";

describe("savePathFromDialogResult", () => {
  it("treats a cancelled dialog with an empty path as cancelled", () => {
    expect(savePathFromDialogResult({ canceled: true, filePath: "" })).toBeUndefined();
  });

  it("treats a cancelled dialog without a path as cancelled", () => {
    expect(savePathFromDialogResult({ canceled: true, filePath: undefined })).toBeUndefined();
  });

  it("treats an empty path as cancelled even when not flagged as cancelled", () => {
    expect(savePathFromDialogResult({ canceled: false, filePath: "" })).toBeUndefined();
  });

  it("returns the chosen path", () => {
    const filePath = "C:\\exports\\modsettings.lsx";
    expect(savePathFromDialogResult({ canceled: false, filePath })).toBe(filePath);
  });
});
