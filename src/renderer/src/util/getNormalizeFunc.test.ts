import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import getNormalizeFunc from "./getNormalizeFunc";

describe.skipIf(process.platform === "win32")("getNormalizeFunc on a case-sensitive folder", () => {
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "normalize-"));
    fs.writeFileSync(path.join(dir, "Skyrim.esm"), "");
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("keeps case by default", async () => {
    const normalize = await getNormalizeFunc(dir);
    expect(normalize("Textures/a.dds")).not.toBe(normalize("textures/A.dds"));
  });

  it("folds case when asked to treat paths case-insensitively", async () => {
    const normalize = await getNormalizeFunc(dir, { caseInsensitive: true });
    expect(normalize("Textures/a.dds")).toBe(normalize("textures/A.dds"));
  });

  it("keeps treating paths case-insensitively for a folder that doesn't exist yet", async () => {
    const normalize = await getNormalizeFunc(path.join(dir, "missing"), { caseInsensitive: true });
    expect(normalize("Textures/a.dds")).toBe(normalize("textures/A.dds"));
  });
});
