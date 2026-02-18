import { BrowserWindow } from "electron";
import { v4 as uuidv4 } from "uuid";

import type { DiffOperation } from "../../shared/types/ipc";
import type { ProfileCommandResult } from "../../shared/profiles/commands";
import type { ProfileLifecycleEvent } from "../../shared/profiles/events";
import type LevelPersist from "../store/LevelPersist";
import type QueryInvalidator from "../store/QueryInvalidator";

import { log } from "../logging";
import { broadcastStatePatch } from "../store/statePatchBroadcast";

interface PendingResponse {
  resolve: (data?: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Orchestrates profile switching in the main process.
 *
 * Uses a sequential queue (one switch at a time) and coordinates
 * with the renderer via IPC for extension-mediated operations
 * (deploy-mods, profile-will-change enqueue).
 */
class ProfileSwitchOrchestrator {
  #mLevelPersist: LevelPersist;
  #mInvalidator: QueryInvalidator | undefined;
  #mSwitchQueue: Promise<ProfileCommandResult> =
    Promise.resolve({ success: true });
  #mPendingResponses: Map<string, PendingResponse> = new Map();

  constructor(
    levelPersist: LevelPersist,
    invalidator?: QueryInvalidator,
  ) {
    this.#mLevelPersist = levelPersist;
    this.#mInvalidator = invalidator;
  }

  /**
   * Queue a profile switch. Only one switch runs at a time.
   */
  public switchProfile(
    profileId: string | undefined,
  ): Promise<ProfileCommandResult> {
    const result = this.#mSwitchQueue.then(() =>
      this.#executeSwitchSequence(profileId),
    );
    // Update queue - swallow errors to prevent queue from stopping
    this.#mSwitchQueue = result.catch(() => ({ success: false }));
    return result;
  }

  /**
   * Resolve a pending event response from the renderer.
   */
  public resolveEventResponse(requestId: string, data?: unknown): void {
    const pending = this.#mPendingResponses.get(requestId);
    if (pending !== undefined) {
      this.#mPendingResponses.delete(requestId);
      pending.resolve(data);
    }
  }

  async #executeSwitchSequence(
    targetProfileId: string | undefined,
  ): Promise<ProfileCommandResult> {
    try {
      // 1. Read current activeProfileId from LevelDB
      let currentProfileId: string | undefined;
      try {
        const raw = await this.#mLevelPersist.getItem([
          "settings", "profiles", "activeProfileId",
        ]);
        currentProfileId = JSON.parse(raw) as string;
      } catch {
        currentProfileId = undefined;
      }

      if (currentProfileId === targetProfileId) {
        return { success: true };
      }

      // 2. Validate target profile exists (if not undefined)
      let targetGameId: string | undefined;
      if (targetProfileId !== undefined) {
        try {
          const raw = await this.#mLevelPersist.getItem([
            "persistent", "profiles", targetProfileId, "gameId",
          ]);
          targetGameId = JSON.parse(raw) as string;
        } catch {
          return {
            success: false,
            error: `Profile ${targetProfileId} not found`,
          };
        }
      }

      // 3. Write nextProfileId to settings
      const settingsOps: DiffOperation[] = [];
      await this.#writeAndCollect(
        ["settings", "profiles", "nextProfileId"],
        targetProfileId,
        settingsOps,
        "nextProfileId",
      );

      // 4. Send request-enqueue-work to renderer
      const enqueueResult = await this.#sendEventAndWait({
        type: "request-enqueue-work",
        profileId: targetProfileId ?? "",
        requestId: uuidv4(),
      });

      // 5. Request deploy for old profile
      if (currentProfileId !== undefined) {
        await this.#sendEventAndWait({
          type: "request-deploy",
          profileId: currentProfileId,
          requestId: uuidv4(),
        });
      }

      // 6. Request deploy for new profile
      if (targetProfileId !== undefined) {
        await this.#sendEventAndWait({
          type: "request-deploy",
          profileId: targetProfileId,
          requestId: uuidv4(),
        });
      }

      // 7. Write activeProfileId and lastActiveProfile to LevelDB
      const persistentOps: DiffOperation[] = [];

      await this.#mLevelPersist.beginTransaction();
      try {
        // Update activeProfileId
        await this.#mLevelPersist.setItem(
          ["settings", "profiles", "activeProfileId"],
          JSON.stringify(targetProfileId),
        );
        settingsOps.push({
          type: "set",
          path: ["profiles", "activeProfileId"],
          value: targetProfileId,
        });

        // Clear nextProfileId
        await this.#mLevelPersist.setItem(
          ["settings", "profiles", "nextProfileId"],
          JSON.stringify(undefined),
        );
        settingsOps.push({
          type: "set",
          path: ["profiles", "nextProfileId"],
          value: undefined,
        });

        // Update lastActiveProfile for game
        if (targetGameId !== undefined && targetProfileId !== undefined) {
          await this.#mLevelPersist.setItem(
            ["settings", "profiles", "lastActiveProfile", targetGameId],
            JSON.stringify(targetProfileId),
          );
          settingsOps.push({
            type: "set",
            path: ["profiles", "lastActiveProfile", targetGameId],
            value: targetProfileId,
          });
        }

        // Update lastActivated on the new profile
        if (targetProfileId !== undefined) {
          const now = Date.now();
          await this.#mLevelPersist.setItem(
            ["persistent", "profiles", targetProfileId, "lastActivated"],
            JSON.stringify(now),
          );
          persistentOps.push({
            type: "set",
            path: ["profiles", targetProfileId, "lastActivated"],
            value: now,
          });
        }

        const dirtyTables = await this.#mLevelPersist.getDirtyTables();
        await this.#mLevelPersist.commitTransaction();

        if (dirtyTables.length > 0) {
          this.#mInvalidator?.notifyDirtyTables(dirtyTables);
        }
      } catch (err) {
        await this.#mLevelPersist.rollbackTransaction();
        throw err;
      }

      // 8. Broadcast patches
      broadcastStatePatch("settings", settingsOps);
      if (persistentOps.length > 0) {
        broadcastStatePatch("persistent", persistentOps);
      }

      // 9. Emit profile-did-change
      this.#broadcastEvent({
        type: "profile-did-change",
        profileId: targetProfileId,
        gameId: targetGameId,
      });

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      log("error", "Profile switch failed", { error: message });
      return { success: false, error: message };
    }
  }

  /**
   * Write a value to LevelDB and collect the DiffOperation.
   */
  async #writeAndCollect(
    keyPath: string[],
    value: unknown,
    operations: DiffOperation[],
    opPathSuffix: string,
  ): Promise<void> {
    await this.#mLevelPersist.setItem(keyPath, JSON.stringify(value));
    operations.push({
      type: "set",
      path: [opPathSuffix],
      value,
    });
  }

  /**
   * Send a profile lifecycle event to all renderer windows and wait for a response.
   */
  async #sendEventAndWait(
    event: ProfileLifecycleEvent & { requestId: string },
    timeoutMs: number = 60000,
  ): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#mPendingResponses.delete(event.requestId);
        reject(new Error(`Event ${event.type} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.#mPendingResponses.set(event.requestId, {
        resolve: (data) => {
          clearTimeout(timer);
          resolve(data);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      this.#broadcastEvent(event);
    });
  }

  /**
   * Broadcast a profile lifecycle event to all renderer windows.
   */
  #broadcastEvent(event: ProfileLifecycleEvent): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed() && window.webContents !== undefined) {
        window.webContents.send("profile:event", event);
      }
    }
  }
}

export default ProfileSwitchOrchestrator;
