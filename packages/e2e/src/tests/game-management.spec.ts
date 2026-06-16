import {
  setupFakeGame,
  cleanupFakeGame,
  GAME_CONFIGS,
  getGameConfig,
} from "../fixtures/game-setup/fake-game";
/**
 * Game management tests.
 * Uses fake game installations to avoid requiring real game installs.
 * Covers test cases: #8.1A, #8.8A
 */
import { test, expect } from "../fixtures/vortex-app";
import { navigateToGames } from "../helpers/navigation";
import { LoginPage } from "../selectors/loginPage";
import { NavBar } from "../selectors/navbar";
import { cleanupVortexInstance, prepareVortexInstance } from "../vortex-instance";

test.describe("Game Management", () => {
  test("can list available games", async ({ vortexWindow }) => {
    await test.step("Navigate to Games page", async () => {
      await navigateToGames(vortexWindow);
    });

    await test.step("Verify games page has content", async () => {
      const bodyContent = await vortexWindow.locator("body").innerText();
      expect(bodyContent.length).toBeGreaterThan(0);
    });
  });

  test("fake game installation helper works", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const config = getGameConfig("stardewvalley");

    await test.step("Create fake game installation", () => {
      const { basePath, gamePath } = setupFakeGame("stardewvalley");
      const otherExecutable = process.platform === "win32" ? "StardewValley" : "Stardew Valley.exe";

      expect(fs.existsSync(path.join(gamePath, config.executable))).toBe(true);
      expect(fs.existsSync(path.join(gamePath, otherExecutable))).toBe(false);
      expect(fs.existsSync(path.join(gamePath, "Content", "Maps"))).toBe(true);
      expect(fs.existsSync(path.join(gamePath, "Mods"))).toBe(true);
      expect(fs.readFileSync(path.join(gamePath, "steam_appid.txt"), "utf8")).toBe("413150");

      cleanupFakeGame(basePath);
      expect(fs.existsSync(basePath)).toBe(false);
    });
  });

  test("BG3 fake fixture creates Larian profile plumbing", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = prepareVortexInstance().userDataDir;
    let basePath: string | undefined;

    try {
      const fakeGame = setupFakeGame("baldursgate3", {
        vortexUserDataDir: root,
      });
      basePath = fakeGame.basePath;
      const { gamePath } = fakeGame;

      expect(fs.existsSync(path.join(gamePath, "bin", "bg3_dx11.exe"))).toBe(true);
      expect(fs.existsSync(path.join(gamePath, "bin", "bg3.exe"))).toBe(true);
      expect(fs.existsSync(path.join(gamePath, "Data"))).toBe(true);

      const larianRoot = path.join(root, "Local", "Larian Studios", "Baldur's Gate 3");
      expect(fs.existsSync(path.join(larianRoot, "Mods"))).toBe(true);
      expect(
        fs.existsSync(path.join(larianRoot, "PlayerProfiles", "Public", "modsettings.lsx")),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(larianRoot, "PlayerProfiles", "global", "modsettings.lsx")),
      ).toBe(true);
    } finally {
      if (basePath !== undefined) cleanupFakeGame(basePath);
      cleanupVortexInstance(root);
    }
  });

  test("all fake game configs hydrate from tree fixtures", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = prepareVortexInstance().userDataDir;
    const gameInstalls: string[] = [];

    try {
      for (const gameId of Object.keys(GAME_CONFIGS)) {
        const fakeGame = setupFakeGame(gameId, { vortexUserDataDir: root });
        gameInstalls.push(fakeGame.basePath);

        for (const requiredFile of getGameConfig(gameId).requiredFiles) {
          expect(fs.existsSync(path.join(fakeGame.gamePath, ...requiredFile.split("/")))).toBe(
            true,
          );
        }
      }
    } finally {
      for (const basePath of gameInstalls) cleanupFakeGame(basePath);
      cleanupVortexInstance(root);
    }
  });

  test("Gothic tree fixture replicates real install layout", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { basePath, gamePath } = setupFakeGame("gothic1remake");

    try {
      const config = getGameConfig("gothic1remake");
      for (const file of config.requiredFiles) {
        expect(fs.existsSync(path.join(gamePath, file))).toBe(true);
      }
      expect(fs.existsSync(path.join(gamePath, "G1R", "Binaries", "Win64"))).toBe(true);
      expect(
        fs.existsSync(path.join(gamePath, "G1R", "Binaries", "Win64", "G1R-Win64-Shipping.exe")),
      ).toBe(true);
      expect(fs.existsSync(path.join(gamePath, "Engine", "Binaries"))).toBe(true);
      expect(fs.existsSync(path.join(gamePath, "G1R", "Content", "Paks", "~mods"))).toBe(true);
      expect(fs.existsSync(path.join(gamePath, "G1R", "Binaries", "Win64", "ue4ss", "Mods"))).toBe(
        true,
      );
      expect(fs.readFileSync(path.join(gamePath, "G1R", "Version", "version.txt"), "utf8")).toBe(
        "Build123_CL456",
      );
    } finally {
      cleanupFakeGame(basePath);
    }
  });

  test.describe("Gothic 1 Remake dynamic GDL extension", () => {
    test.use({ dynamicGameExtensionId: "gothic1remake", managedGameId: "gothic1remake" });

    test("can manage Gothic 1 Remake", async ({ managedGame }) => {
      const fs = await import("node:fs");
      const path = await import("node:path");

      expect(fs.existsSync(path.join(managedGame.gamePath, "G1R-Win64-Shipping.exe"))).toBe(true);
      expect(fs.existsSync(path.join(managedGame.gamePath, "G1R", "Content"))).toBe(true);
    });
  });

  test("[QA-106] can manage a game while not logged in", async ({
    vortexWindow,
    managedGame: _g,
  }) => {
    await test.step("App is signed out", async () => {
      const loginPage = new LoginPage(vortexWindow);
      await expect(loginPage.vortexLoginButton).toBeVisible();
    });

    await test.step("Mods page is reachable for the managed game", async () => {
      const navbar = new NavBar(vortexWindow);
      await expect(navbar.modsLink).toBeVisible();
    });
  });
});
