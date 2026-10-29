import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncFromProfile, syncToProfile } from "./sync";

describe("profile file sync", () => {
  let gameDir: string;
  let profileDir: string;

  beforeEach(() => {
    gameDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-game-"));
    profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-profile-"));
  });

  afterEach(() => {
    fs.rmSync(gameDir, { recursive: true, force: true });
    fs.rmSync(profileDir, { recursive: true, force: true });
  });

  it("updates the profile's copy when the game file's case differs", async () => {
    fs.writeFileSync(path.join(profileDir, "plugins.txt"), "old");
    fs.writeFileSync(path.join(gameDir, "Plugins.txt"), "new");

    await syncToProfile(profileDir, [path.join(gameDir, "Plugins.txt")], vi.fn());

    expect(fs.readdirSync(profileDir)).toEqual(["plugins.txt"]);
    expect(fs.readFileSync(path.join(profileDir, "plugins.txt"), "utf8")).toBe("new");
  });

  it("restores the profile's copy into a game file whose case differs", async () => {
    fs.writeFileSync(path.join(profileDir, "plugins.txt"), "saved");
    fs.writeFileSync(path.join(gameDir, "Plugins.txt"), "current");

    await syncFromProfile(profileDir, [path.join(gameDir, "Plugins.txt")], vi.fn());

    expect(fs.readFileSync(path.join(gameDir, "Plugins.txt"), "utf8")).toBe("saved");
  });
});
