import type { ISerializedDiscovery, ISerializedGameMeta } from "@vortex/shared/ipc";
import type { IDiscoveryResult } from "../types/IState";
import type { IGame } from "../types/IGame";

import PromiseBB from "bluebird";

/**
 * Implements IGame by forwarding all dynamic calls to the main process via IPC.
 * One instance is created per game registered in the main-process adaptor registry.
 *
 * Static metadata (id, name, requiredFiles, etc.) is read directly from the serialized
 * metadata received at startup. Dynamic behaviour (queryPath, setup, getGameVersion)
 * is dispatched to main over the game-adaptor IPC channels.
 */
export class MainProcessGameBridge implements IGame {
  readonly id: string;
  readonly name: string;
  readonly shortName?: string;
  readonly logo?: string;
  readonly requiredFiles: string[];
  readonly mergeMods: boolean;
  readonly environment?: { [key: string]: string };
  readonly parameters?: string[];
  readonly details?: { [key: string]: unknown };
  readonly compatible?: { [key: string]: boolean };

  readonly queryPath?: () => PromiseBB<string>;
  readonly queryModPath: (gamePath: string) => string;
  readonly executable: (discoveredPath?: string) => string;
  readonly setup?: (discovery: IDiscoveryResult) => PromiseBB<void>;
  readonly getGameVersion?: (gamePath: string, exePath: string) => PromiseLike<string>;

  constructor(meta: ISerializedGameMeta) {
    this.id = meta.id;
    this.name = meta.name;
    this.shortName = meta.shortName;
    this.logo = meta.logo;
    this.requiredFiles = meta.requiredFiles;
    this.mergeMods = meta.mergeMods;
    this.environment = meta.environment;
    this.parameters = meta.parameters;
    this.details = meta.details;
    this.compatible = meta.compatible;

    this.executable = (_discoveredPath?: string) => meta.executablePath;
    this.queryModPath = (_gamePath: string) => meta.modPath;

    if (meta.hasQueryPath) {
      this.queryPath = () =>
        PromiseBB.resolve(
          window.api.gameAdaptors.queryPath(meta.id).then((result) => result ?? ""),
        );
    }

    if (meta.hasSetup) {
      this.setup = (discovery: IDiscoveryResult) => {
        const serialized: ISerializedDiscovery = {
          path: discovery.path ?? "",
          executable: discovery.executable,
          store: discovery.store,
        };
        return PromiseBB.resolve(
          window.api.gameAdaptors.setup(meta.id, serialized),
        );
      };
    }

    if (meta.hasGetGameVersion) {
      this.getGameVersion = (gamePath: string, exePath: string) =>
        window.api.gameAdaptors.getGameVersion(meta.id, gamePath, exePath);
    }
  }
}
