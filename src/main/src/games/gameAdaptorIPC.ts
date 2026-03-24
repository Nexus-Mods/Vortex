import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import { GameAdaptorRegistry } from "./GameAdaptorRegistry";

/**
 * Register all IPC handlers for the game adaptor system.
 * Must be called once during application startup (from setupMainExtensions).
 */
export function initGameAdaptorIPC(): void {
  const registry = GameAdaptorRegistry.getInstance();

  betterIpcMain.handle("game-adaptor:list", () => {
    return registry.listGames();
  });

  betterIpcMain.handle("game-adaptor:queryPath", async (_event, gameId) => {
    const game = registry.getGame(gameId);
    if (game === undefined) {
      log("warn", "game-adaptor:queryPath — unknown game", { gameId });
      return null;
    }
    if (game.queryPath === undefined) {
      return null;
    }
    return game.queryPath();
  });

  betterIpcMain.handle("game-adaptor:setup", async (_event, gameId, discovery) => {
    const game = registry.getGame(gameId);
    if (game === undefined) {
      log("warn", "game-adaptor:setup — unknown game", { gameId });
      return;
    }
    if (game.setup === undefined) {
      return;
    }
    await game.setup(discovery);
  });

  betterIpcMain.handle(
    "game-adaptor:getGameVersion",
    async (_event, gameId, gamePath, exePath) => {
      const game = registry.getGame(gameId);
      if (game === undefined || game.getGameVersion === undefined) {
        return "";
      }
      return game.getGameVersion(gamePath, exePath);
    },
  );

  betterIpcMain.handle("installer-adaptor:list", () => {
    return registry.listInstallers();
  });

  betterIpcMain.handle(
    "installer-adaptor:testSupported",
    async (_event, id, files, gameId) => {
      const installer = registry.getInstaller(id);
      if (installer === undefined) {
        log("warn", "installer-adaptor:testSupported — unknown installer", { id });
        return { supported: false, requiredFiles: [] };
      }
      return installer.testSupported(files, gameId);
    },
  );

  betterIpcMain.handle(
    "installer-adaptor:install",
    async (_event, id, files, tempPath, gameId) => {
      const installer = registry.getInstaller(id);
      if (installer === undefined) {
        log("warn", "installer-adaptor:install — unknown installer", { id });
        return { instructions: [] };
      }
      return installer.install(files, tempPath, gameId);
    },
  );

  log("info", "Game adaptor IPC handlers registered");
}
