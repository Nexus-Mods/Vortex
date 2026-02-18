import type { DiffOperation } from "../../shared/types/ipc";
import type {
  ProfileCommand,
  ProfileCommandResult,
} from "../../shared/profiles/commands";
import type LevelPersist from "../store/LevelPersist";
import type QueryInvalidator from "../store/QueryInvalidator";

import { log } from "../logging";
import { broadcastStatePatch } from "../store/statePatchBroadcast";

/**
 * Handles profile commands in the main process.
 *
 * Simple mutations (create, remove, set-mod-enabled, etc.) write directly
 * to LevelDB, collect DiffOperations, then broadcast them to renderer Redux
 * stores via the generic state:patch channel.
 *
 * The profile:switch command is delegated to ProfileSwitchOrchestrator.
 */
class ProfileCommandHandler {
  #mLevelPersist: LevelPersist;
  #mInvalidator: QueryInvalidator | undefined;

  constructor(
    levelPersist: LevelPersist,
    invalidator?: QueryInvalidator,
  ) {
    this.#mLevelPersist = levelPersist;
    this.#mInvalidator = invalidator;
  }

  public setInvalidator(invalidator: QueryInvalidator): void {
    this.#mInvalidator = invalidator;
  }

  public async execute(command: ProfileCommand): Promise<ProfileCommandResult> {
    try {
      switch (command.type) {
        case "profile:create":
          return await this.#handleCreate(command);
        case "profile:remove":
          return await this.#handleRemove(command);
        case "profile:set-mod-enabled":
          return await this.#handleSetModEnabled(command);
        case "profile:set-mods-enabled":
          return await this.#handleSetModsEnabled(command);
        case "profile:set-feature":
          return await this.#handleSetFeature(command);
        case "profile:forget-mod":
          return await this.#handleForgetMod(command);
        case "profile:set-activated":
          return await this.#handleSetActivated(command);
        case "profile:switch":
          // Delegated to orchestrator — handled in index.ts
          return {
            success: false,
            error: "profile:switch must be handled by the orchestrator",
          };
        default:
          return { success: false, error: `Unknown command type` };
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      log("error", "ProfileCommandHandler: command failed", {
        type: command.type,
        error: message,
      });
      return { success: false, error: message };
    }
  }

  async #handleCreate(command: Extract<ProfileCommand, { type: "profile:create" }>): Promise<ProfileCommandResult> {
    const { profile } = command;
    const operations: DiffOperation[] = [];

    await this.#mLevelPersist.beginTransaction();
    try {
      // Write each profile attribute as a separate key
      const attrs: Array<[string, unknown]> = [
        ["name", profile.name],
        ["gameId", profile.gameId],
        ["lastActivated", profile.lastActivated],
        ["modState", profile.modState ?? {}],
      ];
      if (profile.features !== undefined) {
        attrs.push(["features", profile.features]);
      }

      for (const [attr, value] of attrs) {
        await this.#mLevelPersist.setItem(
          ["persistent", "profiles", profile.id, attr],
          JSON.stringify(value),
        );
        operations.push({
          type: "set",
          path: ["profiles", profile.id, attr],
          value,
        });
      }

      const dirtyTables = await this.#mLevelPersist.getDirtyTables();
      await this.#mLevelPersist.commitTransaction();

      if (dirtyTables.length > 0) {
        this.#mInvalidator?.notifyDirtyTables(dirtyTables);
      }
      broadcastStatePatch("persistent", operations);

      return { success: true };
    } catch (err) {
      await this.#mLevelPersist.rollbackTransaction();
      throw err;
    }
  }

  async #handleRemove(command: Extract<ProfileCommand, { type: "profile:remove" }>): Promise<ProfileCommandResult> {
    const { profileId } = command;
    const operations: DiffOperation[] = [];

    await this.#mLevelPersist.beginTransaction();
    try {
      // Get all keys for this profile to remove them
      const allKVs = await this.#mLevelPersist.getAllKVs(
        `persistent###profiles###${profileId}`,
      );

      for (const kv of allKVs) {
        await this.#mLevelPersist.removeItem(kv.key);
      }

      operations.push({
        type: "remove",
        path: ["profiles", profileId],
      });

      const dirtyTables = await this.#mLevelPersist.getDirtyTables();
      await this.#mLevelPersist.commitTransaction();

      if (dirtyTables.length > 0) {
        this.#mInvalidator?.notifyDirtyTables(dirtyTables);
      }
      broadcastStatePatch("persistent", operations);

      return { success: true };
    } catch (err) {
      await this.#mLevelPersist.rollbackTransaction();
      throw err;
    }
  }

  async #handleSetModEnabled(
    command: Extract<ProfileCommand, { type: "profile:set-mod-enabled" }>,
  ): Promise<ProfileCommandResult> {
    const { profileId, modId, enabled } = command;

    return this.#updateModState(profileId, (modState) => {
      if (enabled) {
        modState[modId] = {
          enabled: true,
          enabledTime: Date.now(),
        };
      } else if (modState[modId] !== undefined) {
        modState[modId] = {
          ...modState[modId],
          enabled: false,
        };
      }
      return modState;
    });
  }

  async #handleSetModsEnabled(
    command: Extract<ProfileCommand, { type: "profile:set-mods-enabled" }>,
  ): Promise<ProfileCommandResult> {
    const { profileId, modIds, enabled } = command;

    return this.#updateModState(profileId, (modState) => {
      for (const modId of modIds) {
        if (enabled) {
          modState[modId] = {
            enabled: true,
            enabledTime: Date.now(),
          };
        } else if (modState[modId] !== undefined) {
          modState[modId] = {
            ...modState[modId],
            enabled: false,
          };
        }
      }
      return modState;
    });
  }

  async #handleSetFeature(
    command: Extract<ProfileCommand, { type: "profile:set-feature" }>,
  ): Promise<ProfileCommandResult> {
    const { profileId, featureId, value } = command;
    const operations: DiffOperation[] = [];

    await this.#mLevelPersist.beginTransaction();
    try {
      // Read current features
      let features: Record<string, unknown> = {};
      try {
        const raw = await this.#mLevelPersist.getItem([
          "persistent", "profiles", profileId, "features",
        ]);
        features = JSON.parse(raw) ?? {};
      } catch {
        // No features yet
      }

      features[featureId] = value;

      await this.#mLevelPersist.setItem(
        ["persistent", "profiles", profileId, "features"],
        JSON.stringify(features),
      );
      operations.push({
        type: "set",
        path: ["profiles", profileId, "features"],
        value: features,
      });

      const dirtyTables = await this.#mLevelPersist.getDirtyTables();
      await this.#mLevelPersist.commitTransaction();

      if (dirtyTables.length > 0) {
        this.#mInvalidator?.notifyDirtyTables(dirtyTables);
      }
      broadcastStatePatch("persistent", operations);

      return { success: true };
    } catch (err) {
      await this.#mLevelPersist.rollbackTransaction();
      throw err;
    }
  }

  async #handleForgetMod(
    command: Extract<ProfileCommand, { type: "profile:forget-mod" }>,
  ): Promise<ProfileCommandResult> {
    const { profileId, modId } = command;

    return this.#updateModState(profileId, (modState) => {
      delete modState[modId];
      return modState;
    });
  }

  async #handleSetActivated(
    command: Extract<ProfileCommand, { type: "profile:set-activated" }>,
  ): Promise<ProfileCommandResult> {
    const { profileId } = command;
    const now = Date.now();
    const operations: DiffOperation[] = [];

    await this.#mLevelPersist.beginTransaction();
    try {
      await this.#mLevelPersist.setItem(
        ["persistent", "profiles", profileId, "lastActivated"],
        JSON.stringify(now),
      );
      operations.push({
        type: "set",
        path: ["profiles", profileId, "lastActivated"],
        value: now,
      });

      const dirtyTables = await this.#mLevelPersist.getDirtyTables();
      await this.#mLevelPersist.commitTransaction();

      if (dirtyTables.length > 0) {
        this.#mInvalidator?.notifyDirtyTables(dirtyTables);
      }
      broadcastStatePatch("persistent", operations);

      return { success: true };
    } catch (err) {
      await this.#mLevelPersist.rollbackTransaction();
      throw err;
    }
  }

  /**
   * Helper: read modState, apply a transform, write back, and broadcast.
   */
  async #updateModState(
    profileId: string,
    transform: (modState: Record<string, { enabled: boolean; enabledTime: number }>) => Record<string, { enabled: boolean; enabledTime: number }>,
  ): Promise<ProfileCommandResult> {
    const operations: DiffOperation[] = [];

    await this.#mLevelPersist.beginTransaction();
    try {
      // Read current modState
      let modState: Record<string, { enabled: boolean; enabledTime: number }> = {};
      try {
        const raw = await this.#mLevelPersist.getItem([
          "persistent", "profiles", profileId, "modState",
        ]);
        modState = JSON.parse(raw) ?? {};
      } catch {
        // No modState yet
      }

      modState = transform(modState);

      await this.#mLevelPersist.setItem(
        ["persistent", "profiles", profileId, "modState"],
        JSON.stringify(modState),
      );
      operations.push({
        type: "set",
        path: ["profiles", profileId, "modState"],
        value: modState,
      });

      const dirtyTables = await this.#mLevelPersist.getDirtyTables();
      await this.#mLevelPersist.commitTransaction();

      if (dirtyTables.length > 0) {
        this.#mInvalidator?.notifyDirtyTables(dirtyTables);
      }
      broadcastStatePatch("persistent", operations);

      return { success: true };
    } catch (err) {
      await this.#mLevelPersist.rollbackTransaction();
      throw err;
    }
  }
}

export default ProfileCommandHandler;
