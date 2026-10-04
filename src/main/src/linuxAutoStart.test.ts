import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { autoStartEntry, setLinuxAutoStart } from "./linuxAutoStart";

describe("linux autostart", () => {
  const previous = process.env.XDG_CONFIG_HOME;
  let configHome: string;

  beforeEach(() => {
    configHome = mkdtempSync(path.join(os.tmpdir(), "vortex-autostart-"));
    process.env.XDG_CONFIG_HOME = configHome;
  });

  afterEach(() => {
    process.env.XDG_CONFIG_HOME = previous;
  });

  it("adds and removes the entry", () => {
    const entry = path.join(configHome, "autostart", "com.nexusmods.vortex.desktop");

    setLinuxAutoStart(true, ["/opt/vortex/vortex", "--start-minimized"]);
    expect(readFileSync(entry, "utf8")).toContain(
      'Exec="/opt/vortex/vortex" "--start-minimized"\n',
    );

    setLinuxAutoStart(false, []);
    expect(existsSync(entry)).toBe(false);
  });

  it("escapes reserved characters in the command", () => {
    expect(autoStartEntry(["/home/me/My $Games/vortex"])).toContain(
      'Exec="/home/me/My \\\\$Games/vortex"\n',
    );
  });
});
