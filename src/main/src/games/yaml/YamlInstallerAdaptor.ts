import type {
  ISerializedInstallResult,
  ISupportedResult,
} from "@vortex/shared/ipc";

import type { IInstallerAdaptor } from "../IGameAdaptor";
import type { AdaptorDocument } from "./types";
import { evaluateRules } from "./pattern-engine";
import { resolveRelativeFolders } from "./resolve-folders";

/**
 * Implements IInstallerAdaptor by running the YAML pattern engine against
 * the mod archive's file list and converting the resulting mappings to
 * Vortex copy instructions.
 *
 * testSupported: returns `supported: true` only for the game this adaptor owns.
 * install: runs evaluateRules() and produces `{ type: "copy" }` instructions.
 */
export class YamlInstallerAdaptor implements IInstallerAdaptor {
  readonly id: string;
  readonly priority: number;

  readonly #doc: AdaptorDocument;
  #folders: Record<string, string> | undefined;

  constructor(doc: AdaptorDocument, priority: number = 25) {
    this.id = `${doc.game.id}-adaptor`;
    this.priority = priority;
    this.#doc = doc;
  }

  async testSupported(
    _files: string[],
    gameId: string,
  ): Promise<ISupportedResult> {
    return {
      supported: gameId === this.#doc.game.id,
      requiredFiles: [],
    };
  }

  async install(
    files: string[],
    _tempPath: string,
    _gameId: string,
  ): Promise<ISerializedInstallResult> {
    // Resolve folder variables once and cache per instance lifetime
    if (this.#folders === undefined) {
      this.#folders = resolveRelativeFolders(this.#doc);
    }

    // Normalize: forward slashes only, drop directory entries
    const normalizedFiles = files
      .map((f) => f.replace(/\\/g, "/"))
      .filter((f) => !f.endsWith("/"));

    const result = evaluateRules(
      this.#doc.rules,
      normalizedFiles,
      this.#folders,
    );

    const instructions: ISerializedInstallResult["instructions"] =
      result.mappings.map((m) => ({
        type: "copy",
        source: m.source,
        destination: m.destination,
      }));

    return { instructions };
  }
}
