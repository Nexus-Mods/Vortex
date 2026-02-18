import type LevelPersist from "../store/LevelPersist";
import type QueryInvalidator from "../store/QueryInvalidator";
import type ProfileSwitchOrchestrator from "./ProfileSwitchOrchestrator";

import { betterIpcMain } from "../ipc";
import { log } from "../logging";
import ProfileCommandHandler from "./ProfileCommandHandler";

let commandHandler: ProfileCommandHandler | undefined;
let switchOrchestrator: ProfileSwitchOrchestrator | undefined;

/**
 * Initialize the profile command system.
 *
 * @param levelPersist - The LevelPersist instance for reading/writing profile data
 * @param invalidator - Optional QueryInvalidator to notify on profile changes
 */
export function initProfileCommands(
  levelPersist: LevelPersist,
  invalidator?: QueryInvalidator,
): void {
  if (commandHandler !== undefined) {
    return;
  }

  commandHandler = new ProfileCommandHandler(levelPersist, invalidator);

  // Register IPC handler for profile commands
  betterIpcMain.handle("profile:command", async (_event, command) => {
    if (command.type === "profile:switch" && switchOrchestrator !== undefined) {
      return switchOrchestrator.switchProfile(command.profileId);
    }
    return commandHandler!.execute(command);
  });

  // Register IPC handler for profile event responses from renderer
  betterIpcMain.on("profile:event-response", (_event, requestId, data) => {
    switchOrchestrator?.resolveEventResponse(requestId, data);
  });

  log("info", "Profile command system initialized");
}

/**
 * Set the switch orchestrator. Called after the orchestrator is created
 * (which may happen after initial setup).
 */
export function setProfileSwitchOrchestrator(
  orchestrator: ProfileSwitchOrchestrator,
): void {
  switchOrchestrator = orchestrator;
}

/**
 * Update the invalidator reference (when query system initializes after profiles).
 */
export function setProfileInvalidator(invalidator: QueryInvalidator): void {
  commandHandler?.setInvalidator(invalidator);
}

/**
 * Get the command handler instance.
 */
export function getProfileCommandHandler(): ProfileCommandHandler | undefined {
  return commandHandler;
}
