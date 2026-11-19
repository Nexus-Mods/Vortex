import { describe, expect, it } from "vitest";

import { gameFolderCheckConfig } from "./config";

describe("gameFolderCheckConfig", () => {
  it("defaults to six file events of 60 KiB", () => {
    expect(gameFolderCheckConfig()).toMatchObject({ maxFileParts: 6, maxEventBytes: 60 * 1024 });
  });

  it("takes the event size and a lower file event count from the flag", () => {
    expect(gameFolderCheckConfig({ maxFileParts: 0, maxEventBytes: 50_000 })).toMatchObject({
      maxFileParts: 0,
      maxEventBytes: 50_000,
    });
  });

  it("caps the file events however high the flag sets them", () => {
    expect(gameFolderCheckConfig({ maxFileParts: 10 }).maxFileParts).toBe(10);
    expect(gameFolderCheckConfig({ maxFileParts: 500 }).maxFileParts).toBe(20);
  });
});
