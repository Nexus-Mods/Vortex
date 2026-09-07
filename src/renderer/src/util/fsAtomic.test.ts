import * as nodeFs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tmpSpy = vi.hoisted((): { lastFileOpts?: Record<string, unknown> } => ({}));

vi.mock("tmp", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    file: (opts: Record<string, unknown>, cb: unknown) => {
      tmpSpy.lastFileOpts = opts;
      return (actual.file as (o: unknown, c: unknown) => void)(opts, cb);
    },
  };
});

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

  it("holds no descriptor on its temp file", async () => {
    // the copy works on the temp PATH, so keeping tmp's descriptor open only creates
    // close bookkeeping; a stray close on a recycled descriptor number can hit an
    // unrelated file (observed: the parallel profile-sync copy's own temp)
    const src = path.join(dir, "src.txt");
    const dest = path.join(dir, "dest.txt");
    nodeFs.writeFileSync(src, "new content");

    await copyFileAtomic(src, dest);

    expect(tmpSpy.lastFileOpts).toMatchObject({ discardDescriptor: true });
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
