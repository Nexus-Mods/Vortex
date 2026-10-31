import { InMemoryFSBuilder, QualifiedPath } from "@vortex/shared/filesystem";
import { describe, expect, it } from "vitest";

import { setLinuxAutoStart } from "./linuxAutoStart";

describe("linux autostart", () => {
  const configHome = QualifiedPath.fromNative("/home/me/.config");
  const entry = configHome.join("autostart", "com.nexusmods.vortex.desktop");

  it("adds and removes the entry", async () => {
    const fs = new InMemoryFSBuilder().build();

    await setLinuxAutoStart(fs, configHome, true, ["/opt/vortex/vortex", "--start-minimized"]);
    expect(new TextDecoder().decode(await fs.readFile(entry))).toContain(
      "Exec=/opt/vortex/vortex --start-minimized\n",
    );

    await setLinuxAutoStart(fs, configHome, false, []);
    expect((await fs.stat(entry)).exists).toBe(false);
  });

  it("does nothing when disabling without an entry", async () => {
    const fs = new InMemoryFSBuilder().build();

    await setLinuxAutoStart(fs, configHome, false, []);
    expect((await fs.stat(entry)).exists).toBe(false);
  });
});
