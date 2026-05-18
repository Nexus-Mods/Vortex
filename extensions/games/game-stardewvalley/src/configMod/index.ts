/**
 * Public entry points for the Stardew config-mod feature.
 *
 * Other extension modules import from this file only. It wires:
 * - the manual "Sync Mod Configurations" toolbar action,
 * - runtime handlers for Vortex events,
 * - and settings-driven revert behavior.
 */
import { selectors } from "vortex-api";
import type { types } from "vortex-api";

import { GAME_ID } from "../common";
import type { IFileEntry } from "../types";
import { onAddedFilesImpl } from "./ingest";
import { onSyncModConfigurations } from "./sync";
import { onRevertFilesImpl, onWillEnableModsImpl } from "./transitions";

/** Registers the manual "Sync Mod Configurations" action in the mods view. */
export function registerConfigMod(context: types.IExtensionContext): void {
  context.registerAction(
    "mod-icons",
    999,
    "swap",
    {},
    "Sync Mod Configurations",
    () => {
      void onSyncModConfigurations(context.api);
    },
    () => {
      const state = context.api.getState();
      return selectors.activeGameId(state) === GAME_ID;
    },
  );
}

/** Handles enable/disable transitions to keep synced config files consistent. */
export async function onWillEnableMods(
  api: types.IExtensionApi,
  profileId: string,
  modIds: string[],
  enabled: boolean,
  options?: any,
): Promise<void> {
  return onWillEnableModsImpl(api, profileId, modIds, enabled, options);
}

/** Restores tracked config files from the synthetic config mod to owning mods. */
export async function onRevertFiles(api: types.IExtensionApi, profileId: string): Promise<void> {
  return onRevertFilesImpl(api, profileId);
}

/** Handles newly added files and routes SDV config files through sync logic. */
export async function onAddedFiles(
  api: types.IExtensionApi,
  profileId: string,
  files: IFileEntry[],
): Promise<void> {
  return onAddedFilesImpl(api, profileId, files);
}
