import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isInside } from "./extensionRequire";

describe("isInside", () => {
  let tmpDir: string;
  let realDir: string;
  let linkDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ext-require-"));
    realDir = path.join(tmpDir, "real");
    linkDir = path.join(tmpDir, "link");
    fs.mkdirSync(path.join(realDir, "bundledPlugins", "game-x"), { recursive: true });
    fs.symlinkSync(realDir, linkDir, "junction");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("matches a module under the extension path", () => {
    const dir = path.join(realDir, "bundledPlugins");
    expect(isInside(path.join(dir, "game-x", "index.cjs"), dir)).toBe(true);
  });

  it("matches a symlink-resolved module filename against an unresolved extension path", () => {
    const filename = path.join(realDir, "bundledPlugins", "game-x", "index.cjs");
    expect(isInside(filename, path.join(linkDir, "bundledPlugins"))).toBe(true);
  });

  it("rejects modules outside the extension path", () => {
    const filename = path.join(tmpDir, "elsewhere", "index.cjs");
    expect(isInside(filename, path.join(linkDir, "bundledPlugins"))).toBe(false);
  });

  it("handles extension paths that don't exist", () => {
    const dir = path.join(tmpDir, "missing");
    expect(isInside(path.join(dir, "x", "index.cjs"), dir)).toBe(true);
  });
});
