import fs from "node:fs";
import path from "node:path";

import { test, expect } from "../fixtures/vortex-app";
import { Timeouts } from "../helpers/timeouts";

const EXTENSION_ID = "open-directory-e2e";

function vortexLogPath(vortexUserDataDir: string): string {
  return path.join(vortexUserDataDir, "userData", "vortex.log");
}

function seededExtensionPath(vortexUserDataDir: string): string {
  return path.join(vortexUserDataDir, "userData", "plugins", EXTENSION_ID);
}

function readLog(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

test.describe("Dynamic extensions", () => {
  test.use({ dynamicExtensionIds: [EXTENSION_ID] });

  test("loads workspace extension from user plugins", async ({
    vortexWindow,
    vortexUserDataDir,
  }) => {
    const pluginPath = seededExtensionPath(vortexUserDataDir);
    const logPath = vortexLogPath(vortexUserDataDir);

    await test.step("Seeded plugin contains dynamic extension files", () => {
      expect(fs.existsSync(path.join(pluginPath, "index.cjs"))).toBe(true);
      expect(fs.existsSync(path.join(pluginPath, "info.json"))).toBe(true);
    });

    await test.step("Renderer initializes dynamic extension", async () => {
      await vortexWindow.waitForLoadState("domcontentloaded");

      await expect
        .poll(() => readLog(logPath), {
          message: "Expected dynamic extension init in vortex.log",
          timeout: Timeouts.LIFECYCLE,
        })
        .toContain(`init extension {"name":"${EXTENSION_ID}"`);

      const log = readLog(logPath);
      expect(log).not.toContain(`failed to load dynamic extension {"name":"${EXTENSION_ID}"`);
      expect(log).not.toContain(`couldn't initialize extension {"name":"${EXTENSION_ID}"`);
    });
  });
});
