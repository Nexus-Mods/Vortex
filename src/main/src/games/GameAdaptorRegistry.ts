import type { ISerializedGameMeta, ISerializedInstallerMeta } from "@vortex/shared/ipc";

import type { IGameAdaptor, IInstallerAdaptor } from "./IGameAdaptor";

/**
 * Central registry for main-process game and installer adaptors.
 * A singleton — use `GameAdaptorRegistry.getInstance()`.
 */
export class GameAdaptorRegistry {
  static #instance: GameAdaptorRegistry | undefined;

  static getInstance(): GameAdaptorRegistry {
    if (GameAdaptorRegistry.#instance === undefined) {
      GameAdaptorRegistry.#instance = new GameAdaptorRegistry();
    }
    return GameAdaptorRegistry.#instance;
  }

  #games = new Map<string, IGameAdaptor>();
  #installers = new Map<string, IInstallerAdaptor>();

  /** Register a game adaptor. Throws if a game with the same id is already registered. */
  registerGame(adaptor: IGameAdaptor): void {
    if (this.#games.has(adaptor.id)) {
      throw new Error(`Game adaptor already registered: ${adaptor.id}`);
    }
    this.#games.set(adaptor.id, adaptor);
  }

  /** Register an installer adaptor. Throws if an installer with the same id is already registered. */
  registerInstaller(adaptor: IInstallerAdaptor): void {
    if (this.#installers.has(adaptor.id)) {
      throw new Error(`Installer adaptor already registered: ${adaptor.id}`);
    }
    this.#installers.set(adaptor.id, adaptor);
  }

  /** Return serialized metadata for all registered games. */
  listGames(): ISerializedGameMeta[] {
    return Array.from(this.#games.values()).map((g) => ({
      id: g.id,
      name: g.name,
      shortName: g.shortName,
      logo: g.logo,
      requiredFiles: g.requiredFiles,
      mergeMods: g.mergeMods,
      modPath: g.modPath,
      executablePath: g.executablePath,
      environment: g.environment,
      parameters: g.parameters,
      details: g.details,
      compatible: g.compatible,
      queryArgs: g.queryArgs,
      hasQueryPath: g.queryPath !== undefined,
      hasSetup: g.setup !== undefined,
      hasGetGameVersion: g.getGameVersion !== undefined,
    }));
  }

  /** Return serialized metadata for all registered installers, sorted by priority (ascending). */
  listInstallers(): ISerializedInstallerMeta[] {
    return Array.from(this.#installers.values())
      .sort((a, b) => a.priority - b.priority)
      .map((i) => ({ id: i.id, priority: i.priority }));
  }

  getGame(id: string): IGameAdaptor | undefined {
    return this.#games.get(id);
  }

  getInstaller(id: string): IInstallerAdaptor | undefined {
    return this.#installers.get(id);
  }
}
