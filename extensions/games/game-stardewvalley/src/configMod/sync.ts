/**
 * Sync engine for moving generated `config.json` files into the synthetic config mod.
 *
 * Responsibilities:
 * - discover eligible config files in deployed mod folders,
 * - import them into the synthetic staging mod,
 * - run purge/deploy transitions so Vortex deployment state stays consistent.
 */
import path from 'path';

import { fs, log, selectors, util } from 'vortex-api';
import type { types } from 'vortex-api';
import type { IEntry } from 'turbowalk';

import { setMergeConfigs } from '../actions';
import {
  GAME_ID,
  MOD_CONFIG,
  NOTIF_ACTIVITY_CONFIG_MOD,
} from '../common';
import { findSMAPITool, getSMAPIMods } from '../smapi';
import { selectMergeConfigsEnabled } from '../state/selectors';
import type { IFileEntry } from '../types';
import { defaultModsRelPath, walkPath } from '../util';
import {
  extractConfigModAttributes,
  initializeConfigMod,
  setConfigModAttribute,
} from './lifecycle';
import { isSmapiInternalPath, shouldSuppressSync } from './policy';

/**
 * Synchronizes detected mod `config.json` files into the synthetic config mod.
 *
 * When merge-config mode is disabled and `silent` is false, this can prompt the
 * user to enable merge-config support before proceeding.
 */
export async function onSyncModConfigurations(
  api: types.IExtensionApi,
  silent?: boolean,
  profileId?: string,
): Promise<void> {
  const state = api.getState();
  const profile = profileId !== undefined
    ? selectors.profileById(state, profileId)
    : selectors.activeProfile(state);
  if ((profile?.gameId !== GAME_ID) || shouldSuppressSync(api)) {
    return;
  }

  const smapiTool = findSMAPITool(api);
  if (!smapiTool?.path) {
    return;
  }

  const mergeConfigs = selectMergeConfigsEnabled(state, profile.id);
  if (!mergeConfigs) {
    if (silent || (api.showDialog === undefined)) {
      return;
    }

    const result = await api.showDialog('info', 'Mod Configuration Sync', {
      bbcode: 'Many Stardew Valley mods generate their own configuration files during game play. By default the generated files are, '
        + 'ingested by their respective mods.[br][/br][br][/br]'
        + 'Unfortunately the mod configuration files are lost when updating or removing a mod.[br][/br][br][/br] This button allows you to '
        + 'Import all of your active mod\'s configuration files into a single mod which will remain unaffected by mod updates.[br][/br][br][/br]'
        + 'Would you like to enable this functionality? (SMAPI must be installed)',
    }, [
      { label: 'Close' },
      { label: 'Enable' },
    ]);

    if (result.action === 'Close') {
      return;
    }

    if (result.action === 'Enable') {
      api.store?.dispatch(setMergeConfigs(profile.id, true));
    }
  }

  try {
    const configMod = await initializeConfigMod(api, profile.id);
    if (configMod === undefined) {
      return;
    }

    // Purge first so moved files are not left in a deployed/linked state.
    await emitLifecycleEvent(api, 'purge-mods');

    const installPath = selectors.installPathForGame(api.getState(), GAME_ID);
    const resolveCandidateName = (file: IEntry): string => {
      const relPath = path.relative(installPath, file.filePath);
      const segments = relPath.split(path.sep);
      return segments[0] ?? '';
    };
    const files = await walkPath(installPath);
    const smapiModIds = getSMAPIMods(api).map(mod => mod.id);
    const isSMAPI = (file: IEntry) => isSmapiInternalPath(file.filePath)
      || smapiModIds.some(modId => file.filePath.includes(modId));
    const filtered = files.reduce((accum: IFileEntry[], file: IEntry) => {
      if (isSMAPI(file)) {
        return accum;
      }

      if (path.basename(file.filePath).toLowerCase() !== MOD_CONFIG) {
        return accum;
      }

      if (path.dirname(file.filePath).includes(configMod.configModPath)) {
        return accum;
      }

      // In the install tree, the first path segment is the owning mod id.
      const candidateName = resolveCandidateName(file);
      if (candidateName === '') {
        return accum;
      }

      if (!util.getSafe(profile, ['modState', candidateName, 'enabled'], false)) {
        return accum;
      }

      accum.push({ filePath: file.filePath, candidates: [candidateName] });
      return accum;
    }, []);

    await addModConfig(api, filtered, profile.id, installPath);
    await emitLifecycleEvent(api, 'deploy-mods');
  } catch (err) {
    api.showErrorNotification?.('Failed to sync mod configurations', err);
  }
}

/** Adds discovered config files into the synthetic config mod staging folder. */
export async function addModConfig(
  api: types.IExtensionApi,
  files: IFileEntry[],
  profileId: string,
  modsPath?: string,
): Promise<void> {
  const configMod = await initializeConfigMod(api, profileId);
  if (configMod === undefined) {
    return;
  }

  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const isInstallPath = modsPath !== undefined;
  const resolvedModsPath = modsPath
    ?? ((discovery?.path !== undefined)
      ? path.join(discovery.path, defaultModsRelPath())
      : undefined);
  if (resolvedModsPath === undefined) {
    return;
  }

  if (findSMAPITool(api) === undefined) {
    return;
  }

  const configModAttributes = extractConfigModAttributes(state, configMod.mod.id);
  const nextAttributes = Array.from(new Set(configModAttributes));
  for (const file of files) {
    const primaryCandidate = file.candidates[0];
    if ((primaryCandidate === undefined) || isSmapiInternalPath(file.filePath)) {
      continue;
    }

    api.sendNotification?.({
      type: 'activity',
      id: NOTIF_ACTIVITY_CONFIG_MOD,
      title: 'Importing config files...',
      message: primaryCandidate,
    });

    if (!configModAttributes.includes(primaryCandidate)) {
      nextAttributes.push(primaryCandidate);
    }

    try {
      const installRelPath = path.relative(resolvedModsPath, file.filePath);
      const segments = installRelPath.split(path.sep);
      // When scanning the install path, drop the leading mod-id segment.
      const relPath = isInstallPath ? segments.slice(1).join(path.sep) : installRelPath;
      const targetPath = path.join(configMod.configModPath, relPath);
      const targetDir = path.extname(targetPath) !== '' ? path.dirname(targetPath) : targetPath;
      await fs.ensureDirWritableAsync(targetDir);
      log('debug', 'importing config file from', {
        source: file.filePath,
        destination: targetPath,
        modId: primaryCandidate,
      });
      await fs.copyAsync(file.filePath, targetPath, { overwrite: true });
      await fs.removeAsync(file.filePath);
    } catch (err) {
      api.showErrorNotification?.('Failed to write mod config', err);
    }
  }

  api.dismissNotification?.(NOTIF_ACTIVITY_CONFIG_MOD);
  setConfigModAttribute(api, configMod.mod.id, Array.from(new Set(nextAttributes)));
}

function emitLifecycleEvent(api: types.IExtensionApi, eventType: DeployLifecycleEvent): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cb = (err: any) => (err !== null ? reject(err) : resolve());
    if (eventType === 'purge-mods') {
      // `purge-mods` accepts an extra boolean argument in the Vortex event API.
      api.events.emit(eventType, false, cb);
      return;
    }

    api.events.emit(eventType, cb);
  });
}

type DeployLifecycleEvent = 'purge-mods' | 'deploy-mods';
