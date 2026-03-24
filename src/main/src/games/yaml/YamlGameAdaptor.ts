import type { ISerializedGameMeta } from "@vortex/shared/ipc";

import type { IGameAdaptor } from "../IGameAdaptor";
import type { AdaptorDocument } from "./types";
import { classifyFolders } from "./resolve-folders";

/**
 * Implements IGameAdaptor from a parsed YAML AdaptorDocument.
 *
 * Store-based discovery (Steam, GOG, Epic, Xbox, registry) is expressed via
 * `queryArgs` so Vortex's built-in game-store helpers handle the actual lookup.
 * No `queryPath()` implementation is needed.
 */
export class YamlGameAdaptor implements IGameAdaptor {
  readonly id: string;
  readonly name: string;
  readonly requiredFiles: string[];
  readonly mergeMods: boolean;
  readonly modPath: string;
  readonly executablePath: string;
  readonly details?: Record<string, string | number | boolean>;

  /** Store discovery args forwarded to the renderer's IGame bridge. */
  readonly queryArgs?: Record<string, Array<{ id: string }>>;

  /** Whether all destination folders resolve within the game directory. */
  readonly allInternal: boolean;

  constructor(doc: AdaptorDocument) {
    const exe = doc.game.executable.replace(/\//g, "\\");

    this.id = doc.game.id;
    this.name = doc.game.name ?? doc.game.id;
    this.requiredFiles = [exe];
    this.mergeMods = true;
    this.modPath = ".";
    this.executablePath = exe;

    const { allInternal } = classifyFolders(doc);
    this.allInternal = allInternal;

    // Build store discovery args
    if (doc.stores) {
      const args: Record<string, Array<{ id: string }>> = {};

      if (doc.stores.steam) {
        const ids = Array.isArray(doc.stores.steam)
          ? doc.stores.steam
          : [doc.stores.steam];
        args.steam = ids.map((id) => ({ id }));
        this.details = { steamAppId: ids[0] };
      }

      if (doc.stores.gog) {
        const ids = Array.isArray(doc.stores.gog)
          ? doc.stores.gog
          : [doc.stores.gog];
        args.gog = ids.map((id) => ({ id }));
      }

      if (doc.stores.epic) {
        const ids = Array.isArray(doc.stores.epic)
          ? doc.stores.epic
          : [doc.stores.epic];
        args.epic = ids.map((id) => ({ id }));
      }

      if (doc.stores.xbox) {
        const ids = Array.isArray(doc.stores.xbox)
          ? doc.stores.xbox
          : [doc.stores.xbox];
        args.xbox = ids.map((id) => ({ id }));
      }

      if (doc.stores.registry) {
        args.registry = [
          {
            id: `${doc.stores.registry.path}:${doc.stores.registry.key}`,
          },
        ];
      }

      if (Object.keys(args).length > 0) {
        this.queryArgs = args;
      }
    }
  }

  /**
   * Produce the serialized metadata that gets sent to the renderer.
   * Includes queryArgs so the bridge can set them on the IGame object.
   */
  toSerializedMeta(): ISerializedGameMeta {
    return {
      id: this.id,
      name: this.name,
      requiredFiles: this.requiredFiles,
      mergeMods: this.mergeMods,
      modPath: this.modPath,
      executablePath: this.executablePath,
      details: this.details,
      queryArgs: this.queryArgs,
      hasQueryPath: false,
      hasSetup: false,
      hasGetGameVersion: false,
    };
  }
}
