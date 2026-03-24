import { log } from "../../logging";
import type { GameAdaptorRegistry } from "../GameAdaptorRegistry";
import { loadYamlAdaptors } from "./loader";
import { classifyFolders } from "./resolve-folders";
import { YamlGameAdaptor } from "./YamlGameAdaptor";
import { YamlInstallerAdaptor } from "./YamlInstallerAdaptor";

export { loadYamlAdaptors } from "./loader";
export type { AdaptorDocument } from "./types";

/**
 * Load all `*.yaml` game adaptor files from `dir`, parse them, and register
 * a YamlGameAdaptor + YamlInstallerAdaptor for each one into `registry`.
 *
 * Games with destinations that resolve outside the game directory (e.g. AppData)
 * are skipped in v1 — the registry only handles game-root-relative paths.
 */
export function registerYamlAdaptors(
  registry: GameAdaptorRegistry,
  dir: string,
): void {
  const docs = loadYamlAdaptors(dir);

  for (const doc of docs) {
    const { allInternal } = classifyFolders(doc);
    if (!allInternal) {
      log("warn", "game-adaptors: skipping — external paths not supported yet", {
        id: doc.game.id,
      });
      continue;
    }

    try {
      registry.registerGame(new YamlGameAdaptor(doc));
      registry.registerInstaller(new YamlInstallerAdaptor(doc));
      log("info", "game-adaptors: registered", { id: doc.game.id });
    } catch (err) {
      log("warn", "game-adaptors: failed to register", {
        id: doc.game.id,
        error: String(err),
      });
    }
  }
}
