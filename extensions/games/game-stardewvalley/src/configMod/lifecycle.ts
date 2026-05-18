/**
 * Synthetic config-mod lifecycle and metadata management.
 *
 * This module is responsible for creating/resolving the generated
 * "Stardew Valley Configuration (...)" mod and maintaining which mod ids
 * currently have config files tracked by that synthetic mod.
 */
import path from "path";

import { actions, selectors } from "vortex-api";
import type { types } from "vortex-api";

import { GAME_ID, MOD_TYPE_CONFIG, RGX_INVALID_CHARS_WINDOWS } from "../common";
import {
  selectConfigModAttributes,
  selectMergeConfigsEnabled,
  selectSdvMods,
} from "../state/selectors";

/** Describes the resolved synthetic config mod for a profile. */
export interface IConfigMod {
  mod: types.IMod;
  configModPath: string;
  profileId: string;
}

/** Sanitizes profile names for filesystem-safe generated mod names. */
export function sanitizeProfileName(input: string): string {
  return input.replace(RGX_INVALID_CHARS_WINDOWS, "_");
}

/** Returns mod ids tracked by the synthetic config mod attribute payload. */
export function extractConfigModAttributes(state: types.IState, configModId: string): string[] {
  return selectConfigModAttributes(state, configModId);
}

/** Persists tracked config-owner mod ids onto the synthetic config mod. */
export function setConfigModAttribute(
  api: types.IExtensionApi,
  configModId: string,
  attributes: string[],
): void {
  api.store?.dispatch(actions.setModAttribute(GAME_ID, configModId, "configMod", attributes));
}

/** Removes tracked owner ids from the synthetic config mod attribute payload. */
export function removeConfigModAttributes(
  api: types.IExtensionApi,
  configMod: types.IMod,
  attributes: string[],
): void {
  const existing = extractConfigModAttributes(api.getState(), configMod.id);
  const nextAttributes = existing.filter((attr) => !attributes.includes(attr));
  setConfigModAttribute(api, configMod.id, nextAttributes);
}

/**
 * Resolves the synthetic config mod and install path for the active or provided profile.
 *
 * Returns undefined when the profile is not Stardew Valley or merge-config mode is disabled.
 */
export async function initializeConfigMod(
  api: types.IExtensionApi,
  profileId?: string,
): Promise<IConfigMod | undefined> {
  const state = api.getState();
  const profile = resolveProfile(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    return undefined;
  }

  const mergeConfigs = selectMergeConfigsEnabled(state, profile.id);
  if (!mergeConfigs) {
    return undefined;
  }

  try {
    const mod = await ensureConfigMod(api, profile);
    const installationPath = selectors.installPathForGame(state, GAME_ID);
    const configModPath = path.join(installationPath, mod.installationPath);
    return {
      mod,
      configModPath,
      profileId: profile.id,
    };
  } catch (err) {
    api.showErrorNotification?.("Failed to resolve config mod path", err);
    return undefined;
  }
}

function resolveProfile(state: types.IState, profileId?: string): types.IProfile | undefined {
  // Runtime events may target non-active profiles; prefer explicit ids when provided.
  return profileId !== undefined
    ? selectors.profileById(state, profileId)
    : selectors.activeProfile(state);
}

function configModName(profileName: string): string {
  return `Stardew Valley Configuration (${sanitizeProfileName(profileName)})`;
}

async function ensureConfigMod(
  api: types.IExtensionApi,
  profile: types.IProfile,
): Promise<types.IMod> {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = selectSdvMods(state);
  // There should be only one synthetic config mod per game/profile context.
  const modInstalled = Object.values(mods).find((iter) => iter.type === MOD_TYPE_CONFIG);
  if (modInstalled !== undefined) {
    return modInstalled;
  }

  const modName = configModName(profile.name);
  const mod = await createConfigMod(api, modName, profile);
  api.store?.dispatch(actions.setModEnabled(profile.id, mod.id, true));
  return mod;
}

async function createConfigMod(
  api: types.IExtensionApi,
  modName: string,
  profile: types.IProfile,
): Promise<types.IMod> {
  const mod = {
    id: modName,
    state: "installed",
    attributes: {
      name: "Stardew Valley Mod Configuration",
      description:
        "This mod is a collective merge of SDV mod configuration files which Vortex maintains " +
        "for the mods you have installed. The configuration is maintained through mod updates, " +
        "but at times it may need to be manually updated",
      logicalFileName: "Stardew Valley Mod Configuration",
      modId: 42,
      version: "1.0.0",
      variant: sanitizeProfileName(profile.name.replace(RGX_INVALID_CHARS_WINDOWS, "_")),
      installTime: new Date(),
      source: "user-generated",
    },
    installationPath: modName,
    type: MOD_TYPE_CONFIG,
  };

  return new Promise<types.IMod>((resolve, reject) => {
    api.events.emit("create-mod", profile.gameId, mod, (error) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(mod as any);
    });
  });
}
