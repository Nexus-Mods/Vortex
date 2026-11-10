import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { requirementExists } from "./requirementExists";

describe("requirementExists", () => {
  let dataPath: string;

  beforeAll(() => {
    dataPath = fs.mkdtempSync(path.join(os.tmpdir(), "requirement-exists-"));
    fs.mkdirSync(path.join(dataPath, "SKSE", "Plugins"), { recursive: true });
    fs.writeFileSync(path.join(dataPath, "SKSE", "Plugins", "po3_PapyrusExtender.dll"), "");
  });

  afterAll(() => {
    fs.rmSync(dataPath, { recursive: true, force: true });
  });

  it("finds a file whose deployed spelling differs from the lowercase id", async () => {
    expect(
      await requirementExists(dataPath, "skse/plugins/po3_papyrusextender.dll", new Set()),
    ).toBe(true);
  });

  it("reports a missing file", async () => {
    expect(await requirementExists(dataPath, "skse/plugins/lumautil.dll", new Set())).toBe(false);
  });

  it("checks plugins against the enabled set instead of the disk", async () => {
    expect(await requirementExists(dataPath, "atlm.esp", new Set(["atlm.esp"]))).toBe(true);
    expect(await requirementExists(dataPath, "other.esp", new Set(["atlm.esp"]))).toBe(false);
  });
});
