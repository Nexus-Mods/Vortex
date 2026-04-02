/**
 * Handles Vortex enable/disable transitions for config-file ownership.
 *
 * When mods are disabled or removed, this module restores tracked config files
 * from the synthetic config mod back to the original mod folders, then updates
 * tracking metadata so ownership remains accurate.
 */
import { RelativePath, ResolvedPath } from "@vortex/paths";

import { fs, selectors } from "vortex-api";
import type { types } from "vortex-api";
import type { IEntry } from "turbowalk";

import { GAME_ID, MOD_CONFIG, MOD_MANIFEST } from "../common";
import { selectSdvMods } from "../state/selectors";
import {
  extractConfigModAttributes,
  initializeConfigMod,
  removeConfigModAttributes,
} from "./lifecycle";
import { deleteFolder, walkPath } from "./filesystem";
import { onSyncModConfigurations } from "./sync";

/**
 * Handles SDV `will-enable-mods` transitions to keep config ownership in sync.
 *
 * Enabling mods triggers a silent sync pass. Disabling tracked mods reverts
 * their config files out of the synthetic config mod.
 */
export async function onWillEnableModsImpl(
  api: types.IExtensionApi,
  profileId: string,
  modIds: string[],
  enabled: boolean,
  options?: any,
): Promise<void> {
  const state = api.getState();
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    return;
  }

  if (enabled) {
    await onSyncModConfigurations(api, true, profileId);
    return;
  }

  const configMod = await initializeConfigMod(api, profileId);
  if (configMod === undefined) {
    return;
  }

  if (modIds.includes(configMod.mod.id)) {
    // Disabling the synthetic mod itself means all tracked files must be restored.
    await onRevertFilesImpl(api, profileId);
    return;
  }

  if (options?.installed || options?.willBeReplaced) {
    return;
  }

  const attributes = extractConfigModAttributes(state, configMod.mod.id);
  const relevantModIds = modIds.filter((id) => attributes.includes(id));
  if (relevantModIds.length === 0) {
    return;
  }

  const installPath = selectors.installPathForGame(state, GAME_ID);
  const installPathResolved = ResolvedPath.make(installPath);
  const mods: { [modId: string]: types.IMod } = selectSdvMods(state);
  for (const modId of relevantModIds) {
    const mod = mods[modId];
    if (!mod?.installationPath) {
      continue;
    }

    const modPath = ResolvedPath.join(
      installPathResolved,
      mod.installationPath,
    );
    const files: IEntry[] = await walkPath(modPath, {
      skipLinks: true,
      skipHidden: true,
      skipInaccessible: true,
    });
    const manifestFile = files.find((file) =>
      ResolvedPath.basenameEqualsIgnoreCase(
        ResolvedPath.make(file.filePath),
        MOD_MANIFEST,
      ),
    );
    if (manifestFile === undefined) {
      continue;
    }

    const relPath = RelativePath.make(
      ResolvedPath.relative(
        modPath,
        ResolvedPath.dirname(ResolvedPath.make(manifestFile.filePath)),
      ),
    );
    const configModPath = ResolvedPath.make(configMod.configModPath);
    const modConfigFilePath = ResolvedPath.join(
      configModPath,
      RelativePath.toString(relPath),
      MOD_CONFIG,
    );
    await fs
      .copyAsync(
        modConfigFilePath,
        ResolvedPath.join(modPath, RelativePath.toString(relPath), MOD_CONFIG),
        {
          overwrite: true,
        },
      )
      .catch(() => null);

    try {
      await applyToConfigMod(api, profileId, () =>
        deleteFolder(ResolvedPath.dirname(modConfigFilePath)),
      );
    } catch (err) {
      api.showErrorNotification?.("Failed to write mod config", err);
      return;
    }
  }

  removeConfigModAttributes(api, configMod.mod, relevantModIds);
}

/** Restores all tracked config files from the synthetic config mod to their mods. */
export async function onRevertFilesImpl(
  api: types.IExtensionApi,
  profileId: string,
): Promise<void> {
  const state = api.getState();
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    return;
  }

  const configMod = await initializeConfigMod(api, profileId);
  if (configMod === undefined) {
    return;
  }

  const attributes = extractConfigModAttributes(state, configMod.mod.id);
  if (attributes.length === 0) {
    return;
  }

  await onWillEnableModsImpl(api, profileId, attributes, false);
}

async function applyToConfigMod(
  api: types.IExtensionApi,
  profileId: string,
  cb: () => Promise<void>,
): Promise<void> {
  try {
    const configMod = await initializeConfigMod(api, profileId);
    if (configMod === undefined) {
      return;
    }

    // Re-deploy around edits so deployment metadata stays consistent.
    await api.emitAndAwait(
      "deploy-single-mod",
      GAME_ID,
      configMod.mod.id,
      false,
    );
    await cb();
    await api.emitAndAwait(
      "deploy-single-mod",
      GAME_ID,
      configMod.mod.id,
      true,
    );
  } catch (err) {
    api.showErrorNotification?.("Failed to write mod config", err);
  }
}
