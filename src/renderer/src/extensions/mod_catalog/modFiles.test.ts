import type { IFileInfo } from "@nexusmods/nexus-api";
import { describe, expect, it } from "vitest";

import { installableFiles, pickPrimaryFile } from "./modFiles";

function file(id: number, category: string, uploaded: number, primary = false): IFileInfo {
  return {
    file_id: id,
    category_name: category,
    uploaded_timestamp: uploaded,
    is_primary: primary,
    name: `file ${id}`,
    file_name: `file-${id}.zip`,
  } as IFileInfo;
}

describe("installableFiles", () => {
  it("leaves out old, archived and removed files and lists main files first", () => {
    const files = [
      file(1, "OLD_VERSION", 5),
      file(2, "OPTIONAL", 9),
      file(3, "MAIN", 1),
      file(4, "ARCHIVED", 9),
      file(5, "MAIN", 8),
    ];
    expect(installableFiles(files).map((f) => f.file_id)).toEqual([5, 3, 2]);
  });
});

describe("pickPrimaryFile", () => {
  it("prefers the file the author marked primary", () => {
    expect(pickPrimaryFile([file(1, "MAIN", 9), file(2, "MAIN", 1, true)])?.file_id).toBe(2);
  });

  it("otherwise takes the newest main file", () => {
    expect(pickPrimaryFile([file(1, "MAIN", 1), file(2, "MAIN", 9)])?.file_id).toBe(2);
  });

  it("gives up when there is no main file, so the user picks one", () => {
    expect(pickPrimaryFile([file(1, "OPTIONAL", 1)])).toBeUndefined();
    expect(pickPrimaryFile(undefined)).toBeUndefined();
  });
});
