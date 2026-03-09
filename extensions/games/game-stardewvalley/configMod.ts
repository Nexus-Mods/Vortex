/* eslint-disable */
import path from 'path';
import { actions, fs, types, selectors, log, util } from 'vortex-api';
import {
  NOTIF_ACTIVITY_CONFIG_MOD, GAME_ID, MOD_CONFIG,
  RGX_INVALID_CHARS_WINDOWS, MOD_TYPE_CONFIG,
  MOD_MANIFEST, SMAPI_INTERNAL_DIRECTORY, getBundledMods
} from './common';
import { setMergeConfigs } from './actions';
import { IFileEntry } from './types';
import { walkPath, defaultModsRelPath, deleteFolder } from './util';

import { getSMAPIMods, findSMAPITool } from './SMAPI';
import { IEntry } from 'turbowalk';

const syncWrapper = (api: types.IExtensionApi) => {
  onSyncModConfigurations(api);
}

export function registerConfigMod(context: types.IExtensionContext) {
  context.registerAction('mod-icons', 999, 'swap', {}, 'Sync Mod Configurations',
    () => syncWrapper(context.api),
    () => {
      const state = context.api.store.getState();
      const gameMode = selectors.activeGameId(state);
      return (gameMode === GAME_ID);
    });
}

const shouldSuppressSync = (api: types.IExtensionApi) => {
  const state = api.getState();
  const suppressOnActivities = ['installing_dependencies'];
  const isActivityRunning = (activity: string) => util.getSafe(state, ['session', 'base', 'activity', activity], []).length > 0;
  const suppressingActivities = suppressOnActivities.filter(activity => isActivityRunning(activity));
  const suppressing = suppressingActivities.length > 0;
  return suppressing;
}

async function onSyncModConfigurations(api: types.IExtensionApi, silent?: boolean): Promise<void> {
  const state = api.getState();
  const profile = selectors.activeProfile(state);
  if (profile?.gameId !== GAME_ID || shouldSuppressSync(api)) {
    return;
  }
  const smapiTool: types.IDiscoveredTool = findSMAPITool(api);
  if (!smapiTool?.path) {
    return;
  }
  const mergeConfigs = util.getSafe(state, ['settings', 'SDV', 'mergeConfigs', profile.id], false);
  if (!mergeConfigs) {
    if (silent) {
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
      { label: 'Enable' }
    ]);

    if (result.action === 'Close') {
      return;
    }

    if (result.action === 'Enable') {
      api.store.dispatch(setMergeConfigs(profile.id, true));
    }
  }

  type EventType = 'purge-mods' | 'deploy-mods';
  const eventPromise = (api: types.IExtensionApi, eventType: EventType) => new Promise<void>((resolve, reject) => {
    const cb = (err: any) => err !== null ? reject(err) : resolve();
    (eventType === 'purge-mods')
      ? api.events.emit(eventType, false, cb)
      : api.events.emit(eventType, cb);
  });

  try {
    const mod = await initialize(api);
    if (mod?.configModPath === undefined) {
      return;
    }
    await eventPromise(api, 'purge-mods');

    const installPath = selectors.installPathForGame(api.getState(), GAME_ID);
    const resolveCandidateName = (file: IEntry): string => {
      const relPath = path.relative(installPath, file.filePath);
      const segments = relPath.split(path.sep);
      return segments[0];
    }
    const files = await walkPath(installPath);
    const SMAPIModIds = getSMAPIMods(api).map(mod => mod.id);
    const isSMAPI = (file: IEntry) => file.filePath.includes(SMAPI_INTERNAL_DIRECTORY) || SMAPIModIds.forEach(modId => file.filePath.includes(modId));
    const filtered = files.reduce((accum: IFileEntry[], file: IEntry) => {
      if (isSMAPI(file)) {
        // Do not touch SMAPI's internal config files
        return accum;
      }
      if (path.basename(file.filePath).toLowerCase() === MOD_CONFIG && !path.dirname(file.filePath).includes(mod.configModPath)) {
        const candidateName = resolveCandidateName(file);
        if (util.getSafe(profile, ['modState', candidateName, 'enabled'], false) === false) {
          return accum;
        }
        accum.push({ filePath: file.filePath, candidates: [candidateName] });
      }
      return accum;
    }, []);
    await addModConfig(api, filtered, installPath);
    await eventPromise(api, 'deploy-mods');
  } catch (err) {
    api.showErrorNotification('Failed to sync mod configurations', err);
  }
}

function sanitizeProfileName(input: string) {
  return input.replace(RGX_INVALID_CHARS_WINDOWS, '_');
}

function configModName(profileName: string) {
  return `Stardew Valley Configuration (${sanitizeProfileName(profileName)})`;
}

type ConfigMod = {
  mod: types.IMod;
  configModPath: string;
}
async function initialize(api: types.IExtensionApi): Promise<ConfigMod> {
  const state = api.getState();
  const profile = selectors.activeProfile(state);
  if (profile?.gameId !== GAME_ID) {
    return Promise.resolve(undefined);
  }
  const mergeConfigs = util.getSafe(state, ['settings', 'SDV', 'mergeConfigs', profile.id], false);
  if (!mergeConfigs) {
    return Promise.resolve(undefined);
  }

  try {
    const mod = await ensureConfigMod(api);
    const installationPath = selectors.installPathForGame(state, GAME_ID);
    const configModPath = path.join(installationPath, mod.installationPath);
    return Promise.resolve({ configModPath, mod });
  } catch (err) {
    api.showErrorNotification('Failed to resolve config mod path', err);
    return Promise.resolve(undefined);
  }
}

export async function addModConfig(api: types.IExtensionApi, files: IFileEntry[], modsPath?: string) {
  const configMod = await initialize(api);
  if (configMod === undefined) {
    return;
  }

  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const isInstallPath = modsPath !== undefined;
  modsPath = modsPath ?? path.join(discovery.path, defaultModsRelPath());
  const smapiTool: types.IDiscoveredTool = findSMAPITool(api);
  if (smapiTool === undefined) {
    return;
  }
  const configModAttributes: string[] = extractConfigModAttributes(state, configMod.mod.id);
  let newConfigAttributes = Array.from(new Set(configModAttributes));
  for (const file of files) {
    const segments = file.filePath.toLowerCase().split(path.sep).filter(seg => !!seg);
    if (segments.includes('smapi_internal')) {
      // Don't touch the internal SMAPI configuration files.
      continue;
    }
    api.sendNotification({
      type: 'activity',
      id: NOTIF_ACTIVITY_CONFIG_MOD,
      title: 'Importing config files...',
      message: file.candidates[0],
    });
    
    if (!configModAttributes.includes(file.candidates[0])) {
      newConfigAttributes.push(file.candidates[0]);
    }
    try {
      const installRelPath = path.relative(modsPath, file.filePath);
      const segments = installRelPath.split(path.sep);
      const relPath = isInstallPath ? segments.slice(1).join(path.sep) : installRelPath;
      const targetPath = path.join(configMod.configModPath, relPath);
      const targetDir = path.extname(targetPath) !== '' ? path.dirname(targetPath) : targetPath;
      await fs.ensureDirWritableAsync(targetDir);
      log('debug', 'importing config file from', { source: file.filePath, destination: targetPath, modId: file.candidates[0] });
      await fs.copyAsync(file.filePath, targetPath, { overwrite: true });
      await fs.removeAsync(file.filePath);
    } catch (err) {
      api.showErrorNotification('Failed to write mod config', err);
    }
  }

  api.dismissNotification(NOTIF_ACTIVITY_CONFIG_MOD);
  setConfigModAttribute(api, configMod.mod.id, Array.from(new Set(newConfigAttributes)));
}

export async function ensureConfigMod(api: types.IExtensionApi): Promise<types.IMod> {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modInstalled = Object.values(mods).find(iter => iter.type === MOD_TYPE_CONFIG);
  if (modInstalled !== undefined) {
    return Promise.resolve(modInstalled);
  } else {
    const profile = selectors.activeProfile(state);
    const modName = configModName(profile.name);
    const mod = await createConfigMod(api, modName, profile);
    api.store.dispatch(actions.setModEnabled(profile.id, mod.id, true));
    return Promise.resolve(mod);
  }
}

async function createConfigMod(api: types.IExtensionApi, modName: string, profile: types.IProfile): Promise<types.IMod> {
  const mod = {
    id: modName,
    state: 'installed',
    attributes: {
      name: 'Stardew Valley Mod Configuration',
      description: 'This mod is a collective merge of SDV mod configuration files which Vortex maintains '
        + 'for the mods you have installed. The configuration is maintained through mod updates, '
        + 'but at times it may need to be manually updated',
      logicalFileName: 'Stardew Valley Mod Configuration',
      modId: 42, // Meaning of life
      version: '1.0.0',
      variant: sanitizeProfileName(profile.name.replace(RGX_INVALID_CHARS_WINDOWS, '_')),
      installTime: new Date(),
      source: 'user-generated',
    },
    installationPath: modName,
    type: MOD_TYPE_CONFIG,
  };

  return new Promise<types.IMod>((resolve, reject) => {
    api.events.emit('create-mod', profile.gameId, mod, async (error) => {
      if (error !== null) {
        return reject(error);
      }
      return resolve(mod as any);
    });
  });
}

export async function onWillEnableMods(api: types.IExtensionApi, profileId: string, modIds: string[], enabled: boolean, options?: any) {
  const state = api.getState();
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    return;
  }

  if (enabled) {
    await onSyncModConfigurations(api, true);
    return;
  }

  const configMod = await initialize(api);
  if (!configMod) {
    return;
  }

  if (modIds.includes(configMod.mod.id)) {
    // The config mod is getting disabled/uninstalled - re-instate all of
    //  the configuration files.
    await onRevertFiles(api, profileId);
    return;
  }

  if (options?.installed || options?.willBeReplaced) {
    // Do nothing, the mods are being re-installed.
    return Promise.resolve();
  }

  const attrib = extractConfigModAttributes(state, configMod.mod.id);
  const relevant = modIds.filter(id => attrib.includes(id));
  if (relevant.length === 0) {
    return;
  }

  const installPath = selectors.installPathForGame(state, GAME_ID);
  if (enabled) {
    await onSyncModConfigurations(api);
    return;
  }

  const mods: { [modId: string]: types.IMod } = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  for (const id of relevant) {
    const mod = mods[id];
    if (!mod?.installationPath) {
      continue;
    }
    const modPath = path.join(installPath, mod.installationPath);
    const files: IEntry[] = await walkPath(modPath, { skipLinks: true, skipHidden: true, skipInaccessible: true });
    const manifestFile = files.find(file => path.basename(file.filePath) === MOD_MANIFEST);
    if (manifestFile === undefined) {
      continue;
    }
    const relPath = path.relative(modPath, path.dirname(manifestFile.filePath));
    const modConfigFilePath = path.join(configMod.configModPath, relPath, MOD_CONFIG);
    await fs.copyAsync(modConfigFilePath, path.join(modPath, relPath, MOD_CONFIG), { overwrite: true }).catch(err => null);
    try {
      await applyToModConfig(api, () => deleteFolder(path.dirname(modConfigFilePath)));
    } catch (err) {
      api.showErrorNotification('Failed to write mod config', err);
      return;
    }
  }

  removeConfigModAttributes(api, configMod.mod, relevant);
}

export async function applyToModConfig(api: types.IExtensionApi, cb: () => Promise<void>) {
  // Applying file operations to the config mod requires us to
  //  remove it from the game directory and deployment manifest before
  //  re-introducing it (this is to avoid ECD)
  try {
    const configMod = await initialize(api);
    await api.emitAndAwait('deploy-single-mod', GAME_ID, configMod.mod.id, false);
    await cb();
    await api.emitAndAwait('deploy-single-mod', GAME_ID, configMod.mod.id, true); 
  } catch (err) {
    api.showErrorNotification('Failed to write mod config', err);
  }
}

export async function onRevertFiles(api: types.IExtensionApi, profileId: string) {
  const state = api.getState();
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    return;
  }
  const configMod = await initialize(api);
  if (!configMod) {
    return;
  }
  const attrib = extractConfigModAttributes(state, configMod.mod.id);
  if (attrib.length === 0) {
    return;
  }

  await onWillEnableMods(api, profileId, attrib, false);
  return;
}

export async function onAddedFiles(api: types.IExtensionApi, profileId: string, files: IFileEntry[]) {
  const state = api.store.getState();
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    // don't care about any other games
    return;
  }

  const smapiTool: types.IDiscoveredTool = findSMAPITool(api);
  if (smapiTool === undefined) {
    // Very important not to add any files if Vortex has no knowledge of SMAPI's location.
    //  this is to avoid pulling SMAPI configuration files into one of the mods installed by Vortex.
    return;
  }
  const isSMAPIFile = (file: IFileEntry) => {
    const segments = file.filePath.toLowerCase().split(path.sep).filter(seg => !!seg);
    return segments.includes('smapi_internal');
  };
  const mergeConfigs = util.getSafe(state, ['settings', 'SDV', 'mergeConfigs', profile.id], false);
  const result = files.reduce((accum, file) => {
    if (mergeConfigs && !isSMAPIFile(file) && path.basename(file.filePath).toLowerCase() === MOD_CONFIG) {
      accum.configs.push(file);
    } else {
      accum.regulars.push(file);
    }
    return accum;
  }, { configs: [] as IFileEntry[], regulars: [] as IFileEntry[] });
  return Promise.all([
    addConfigFiles(api, profileId, result.configs),
    addRegularFiles(api, profileId, result.regulars)
  ]);
}

function extractConfigModAttributes(state: types.IState, configModId: string): any {
  return util.getSafe(state, ['persistent', 'mods', GAME_ID, configModId, 'attributes', 'configMod'], []);
}

function setConfigModAttribute(api: types.IExtensionApi, configModId: string, attributes: string[]) {
  api.store.dispatch(actions.setModAttribute(GAME_ID, configModId, 'configMod', attributes));
}

function removeConfigModAttributes(api: types.IExtensionApi, configMod: types.IMod, attributes: string[]) {
  const existing = extractConfigModAttributes(api.getState(), configMod.id);
  const newAttributes = existing.filter(attr => !attributes.includes(attr));
  setConfigModAttribute(api, configMod.id, newAttributes);
}

async function addConfigFiles(api: types.IExtensionApi, profileId: string, files: IFileEntry[]) {
  if (files.length === 0) {
    return Promise.resolve();
  }
  api.sendNotification({
    type: 'activity',
    id: NOTIF_ACTIVITY_CONFIG_MOD,
    title: 'Importing config files...',
    message: 'Starting up...'
  });

  return addModConfig(api, files, undefined);
}

async function addRegularFiles(api: types.IExtensionApi, profileId: string, files: IFileEntry[]) {
  if (files.length === 0) {
    return Promise.resolve();
  }
  const state = api.getState();
  const game = util.getGame(GAME_ID);
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const modPaths = game.getModPaths(discovery.path);
  const installPath = selectors.installPathForGame(state, GAME_ID);
  for (const entry of files) {
    if (entry.candidates.length === 1) {
      const mod = util.getSafe(state.persistent.mods,
        [GAME_ID, entry.candidates[0]],
        undefined);
      if (!isModCandidateValid(mod, entry)) {
        return Promise.resolve();
      }
      const from = modPaths[mod.type ?? ''];
      if (from === undefined) {
        // How is this even possible? regardless it's not this
        //  function's job to report this.
        log('error', 'failed to resolve mod path for mod type', mod.type);
        return Promise.resolve();
      }
      const relPath = path.relative(from, entry.filePath);
      const targetPath = path.join(installPath, mod.id, relPath);
      // copy the new file back into the corresponding mod, then delete it. That way, vortex will
      // create a link to it with the correct deployment method and not ask the user any questions
      try {
        await fs.ensureDirWritableAsync(path.dirname(targetPath));
        await fs.copyAsync(entry.filePath, targetPath);
        await fs.removeAsync(entry.filePath);
      } catch (err) {
        if (!err.message.includes('are the same file')) {
          // should we be reporting this to the user? This is a completely
          // automated process and if it fails more often than not the
          // user probably doesn't care
          log('error', 'failed to re-import added file to mod', err.message);
        }
      }
    }
  }
}

const isModCandidateValid = (mod, entry) => {
  if (mod?.id === undefined || mod.type === 'sdvrootfolder') {
    // There is no reliable way to ascertain whether a new file entry
    //  actually belongs to a root modType as some of these mods will act
    //  as replacement mods. This obviously means that if the game has
    //  a substantial update which introduces new files we could potentially
    //  add a vanilla game file into the mod's staging folder causing constant
    //  contention between the game itself (when it updates) and the mod.
    //
    // There is also a potential chance for root modTypes to conflict with regular
    //  mods, which is why it's not safe to assume that any addition inside the
    //  mods directory can be safely added to this mod's staging folder either.
    return false;
  }

  if (mod.type !== 'SMAPI') {
    // Other mod types do not require further validation - it should be fine
    //  to add this entry.
    return true;
  }

  const segments = entry.filePath.toLowerCase().split(path.sep).filter(seg => !!seg);
  const modsSegIdx = segments.indexOf('mods');
  const modFolderName = ((modsSegIdx !== -1) && (segments.length > modsSegIdx + 1))
    ? segments[modsSegIdx + 1] : undefined;

  let bundledMods = util.getSafe(mod, ['attributes', 'smapiBundledMods'], []);
  bundledMods = bundledMods.length > 0 ? bundledMods : getBundledMods();
  if (segments.includes('content')) {
    // SMAPI is not supposed to overwrite the game's content directly.
    //  this is clearly not a SMAPI file and should _not_ be added to it.
    return false;
  }

  return (modFolderName !== undefined) && bundledMods.includes(modFolderName);
};