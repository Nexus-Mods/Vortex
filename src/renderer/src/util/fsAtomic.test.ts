import * as nodeFs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { copyFileAtomic } from "./fsAtomic";

describe("copyFileAtomic", () => {
  let dir: string;

  beforeEach(() => {
    dir = nodeFs.mkdtempSync(path.join(os.tmpdir(), "fs-atomic-"));
  });

  afterEach(() => {
    nodeFs.rmSync(dir, { recursive: true, force: true });
  });

  it("replaces the destination with the source content", async () => {
    const src = path.join(dir, "src.txt");
    const dest = path.join(dir, "dest.txt");
    nodeFs.writeFileSync(src, "new content");
    nodeFs.writeFileSync(dest, "old content");

    await copyFileAtomic(src, dest);

    expect(nodeFs.readFileSync(dest, "utf8")).toBe("new content");
  });

  it("creates the destination when it does not exist yet", async () => {
    const src = path.join(dir, "src.txt");
    const dest = path.join(dir, "dest.txt");
    nodeFs.writeFileSync(src, "new content");

    await copyFileAtomic(src, dest);

    expect(nodeFs.readFileSync(dest, "utf8")).toBe("new content");
  });

  it("keeps the destination intact when the source does not exist", async () => {
    const src = path.join(dir, "missing.txt");
    const dest = path.join(dir, "dest.txt");
    nodeFs.writeFileSync(dest, "old content");

    await expect(copyFileAtomic(src, dest)).rejects.toMatchObject({ code: "ENOENT" });

    expect(nodeFs.readFileSync(dest, "utf8")).toBe("old content");
    // the temp file must not linger next to the destination either
    expect(nodeFs.readdirSync(dir)).toEqual(["dest.txt"]);
  });
});
