/**
 * Handles Vortex `added-files` events for Stardew Valley.
 *
 * When Vortex detects new files in the game folder, this module decides whether
 * each file should be merged into the synthetic config mod or routed back into
 * a regular mod staging folder.
 */
import path from "path";

import { fs, log, selectors, util } from "vortex-api";
import type { types } from "vortex-api";

import { GAME_ID, MOD_CONFIG, NOTIF_ACTIVITY_CONFIG_MOD } from "../common";
import { findSMAPITool } from "../smapi/selectors";
import { selectMergeConfigsEnabled } from "../state/selectors";
import type { IFileEntry } from "../types";
import { addModConfig } from "./sync";
import { isModCandidateValid, isSmapiInternalPath } from "./policy";

/** Handles SDV `added-files` events and routes config vs regular file ingestion. */
export async function onAddedFilesImpl(
  api: types.IExtensionApi,
  profileId: string,
  files: IFileEntry[],
): Promise<void> {
  const state = api.getState();

  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    return;
  }

  if (findSMAPITool(api) === undefined) {
    return;
  }

  const mergeConfigs = selectMergeConfigsEnabled(state, profile.id);
  const routed = files.reduce(
    (accum, file) => {
      // Config files are optionally merged; everything else follows normal re-ingestion.
      if (
        mergeConfigs &&
        !isSmapiInternalPath(file.filePath) &&
        path.basename(file.filePath).toLowerCase() === MOD_CONFIG
      ) {
        accum.configs.push(file);
      } else {
        accum.regulars.push(file);
      }

      return accum;
    },
    { configs: [] as IFileEntry[], regulars: [] as IFileEntry[] },
  );

  await Promise.all([
    addConfigFiles(api, profileId, routed.configs),
    addRegularFiles(api, routed.regulars),
  ]);
}

async function addConfigFiles(
  api: types.IExtensionApi,
  profileId: string,
  files: IFileEntry[],
): Promise<void> {
  if (files.length === 0) {
    return;
  }

  api.sendNotification?.({
    type: "activity",
    id: NOTIF_ACTIVITY_CONFIG_MOD,
    title: "Importing config files...",
    message: "Starting up...",
  });
  await addModConfig(api, files, profileId);
}

async function addRegularFiles(
  api: types.IExtensionApi,
  files: IFileEntry[],
): Promise<void> {
  if (files.length === 0) {
    return;
  }

  const state = api.getState();
  const game = util.getGame(GAME_ID);
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  if (game.getModPaths === undefined || discovery?.path === undefined) {
    return;
  }

  const modPaths = game.getModPaths(discovery.path);
  const installPath = selectors.installPathForGame(state, GAME_ID);
  for (const entry of files) {
    // Vortex only auto-routes when candidate ownership is unambiguous.
    if (entry.candidates.length !== 1) {
      continue;
    }

    const candidateId = entry.candidates[0];
    if (candidateId === undefined) {
      continue;
    }

    const mod = util.getSafe(
      state.persistent.mods,
      [GAME_ID, candidateId],
      undefined,
    ) as types.IMod | undefined;
    if (!isModCandidateValid(mod, entry)) {
      continue;
    }

    const from = modPaths[mod.type];
    if (from === undefined) {
      log("error", "failed to resolve mod path for mod type", mod.type);
      continue;
    }

    const relPath = path.relative(from, entry.filePath);
    const targetPath = path.join(installPath, mod.id, relPath);
    try {
      await fs.ensureDirWritableAsync(path.dirname(targetPath));
      await fs.copyAsync(entry.filePath, targetPath);
      await fs.removeAsync(entry.filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("are the same file")) {
        log("error", "failed to re-import added file to mod", message);
      }
    }
  }
}
