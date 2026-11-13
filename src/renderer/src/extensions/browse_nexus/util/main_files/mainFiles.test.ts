import type { IFileInfo } from "@nexusmods/nexus-api";
import { describe, expect, it } from "vitest";

import { mainFilesOf } from "./mainFiles";

const file = (
  file_id: number,
  category_id: number,
  uploaded_timestamp: number,
  is_primary = false,
) => ({ file_id, category_id, uploaded_timestamp, is_primary }) as IFileInfo;

describe("mainFilesOf", () => {
  it("drops files that aren't Main", () => {
    const files = [file(1, 1, 10), file(2, 2, 20), file(3, 4, 30), file(4, 6, 40)];
    expect(mainFilesOf(files).map((f) => f.file_id)).toEqual([1]);
  });

  it("puts the primary file first", () => {
    const files = [file(1, 1, 30), file(2, 1, 10, true), file(3, 1, 20)];
    expect(mainFilesOf(files).map((f) => f.file_id)).toEqual([2, 1, 3]);
  });

  it("orders the rest newest first", () => {
    const files = [file(1, 1, 10), file(2, 1, 30), file(3, 1, 20)];
    expect(mainFilesOf(files).map((f) => f.file_id)).toEqual([2, 3, 1]);
  });
});
