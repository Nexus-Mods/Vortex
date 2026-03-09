import Bluebird from 'bluebird';
import path from 'path';
import turbowalk from 'turbowalk';
import { actions, fs, selectors, types, util } from 'vortex-api';
import { Parser } from 'xml2js';

import { setUDF } from './actions';

import { DEFAULT_LAUNCHER_SETTINGS, GAME_ID, MOD_INFO, launcherSettingsFilePath, loadOrderFilePath } from './common';
import { IProps } from './types';

const PARSER = new Parser({ explicitRoot: false });

export async function purge(api: types.IExtensionApi): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    api.events.emit('purge-mods', false, (err) => err ? reject(err) : resolve()));
}

export async function deploy(api: types.IExtensionApi): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    api.events.emit('deploy-mods', (err) => err ? reject(err) : resolve()));
}

export const relaunchExt = (api: types.IExtensionApi) => {
  return api.showDialog('info', 'Restart Required', {
    text: 'The extension requires a restart to complete the UDF setup. '
        + 'The extension will now exit - please re-activate it via the games page or dashboard.',
  }, [ { label: 'Restart Extension' } ])
  .then(async () => {
    try {
      await purge(api);
      const batched = [
        actions.setDeploymentNecessary(GAME_ID, true),
        actions.setNextProfile(undefined),
      ];
      util.batchDispatch(api.store, batched);
    } catch (err) {
      api.showErrorNotification('Failed to set up UDF', err);
      return Promise.resolve();
    }
  });
}

export const selectUDF = async (context: types.IExtensionContext) => {
  const launcherSettings = launcherSettingsFilePath();
  const res = await context.api.showDialog('info', 'Choose User Data Folder', {
    text: 'The modding pattern for 7DTD is changing. The Mods path inside the game directory '
      + 'is being deprecated and mods located in the old path will no longer work in the near '
      + 'future. Please select your User Data Folder (UDF) - Vortex will deploy to this new location. '
      + 'Please NEVER set your UDF path to Vortex\'s staging folder.',
  },
    [
      { label: 'Cancel' },
      { label: 'Select UDF' },
    ]);
  if (res.action !== 'Select UDF') {
    return Promise.reject(new util.ProcessCanceled('Cannot proceed without UDF'));
  }
  await fs.ensureDirWritableAsync(path.dirname(launcherSettings));
  await ensureLOFile(context);
  let directory = await context.api.selectDir({
    title: 'Select User Data Folder',
    defaultPath: path.join(path.dirname(launcherSettings)),
  });
  if (!directory) {
    return Promise.reject(new util.ProcessCanceled('Cannot proceed without UDF'));
  }

  const segments = directory.split(path.sep);
  const lowered = segments.map(seg => seg.toLowerCase());
  if (lowered[lowered.length - 1] === 'mods') {
    segments.pop();
    directory = segments.join(path.sep);
  }
  if (lowered.includes('vortex')) {
    return context.api.showDialog('info', 'Invalid User Data Folder', {
      text: 'The UDF cannot be set inside Vortex directories. Please select a different folder.',
    }, [
      { label: 'Try Again' }
    ]).then(() => selectUDF(context));
  }
  await fs.ensureDirWritableAsync(path.join(directory, 'Mods'));
  const launcher = DEFAULT_LAUNCHER_SETTINGS;
  launcher.DefaultRunConfig.AdditionalParameters = `-UserDataFolder="${directory}"`;
  const launcherData = JSON.stringify(launcher, null, 2);
  await fs.writeFileAsync(launcherSettings, launcherData, { encoding: 'utf8' });
  context.api.store.dispatch(setUDF(directory));
  return relaunchExt(context.api);
};

export function getModsPath(api: types.IExtensionApi): string {
  const state = api.getState();
  const udf = util.getSafe(state, ['settings', '7daystodie', 'udf'], undefined);
  return udf !== undefined ? path.join(udf, 'Mods') : 'Mods';
}

// We _should_ just export this from vortex-api, but I guess it's not wise to make it
//  easy for users since we want to move away from bluebird in the future ?
export function toBlue<T>(func: (...args: any[]) => Promise<T>): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

export function genProps(context: types.IExtensionContext, profileId?: string): IProps {
  const api = context.api;
  const state = api.getState();
  const profile: types.IProfile = (profileId !== undefined)
    ? selectors.profileById(state, profileId)
    : selectors.activeProfile(state);

  if (profile?.gameId !== GAME_ID) {
    return undefined;
  }

  const discovery: types.IDiscoveryResult = util.getSafe(state,
    ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  if (discovery?.path === undefined) {
    return undefined;
  }

  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  return { api, state, profile, mods, discovery };
}

export async function ensureLOFile(context: types.IExtensionContext,
                      profileId?: string,
                      props?: IProps): Promise<string> {
  if (props === undefined) {
    props = genProps(context, profileId);
  }

  if (props === undefined) {
    return Promise.reject(new util.ProcessCanceled('failed to generate game props'));
  }

  const targetPath = loadOrderFilePath(props.profile.id);
  try {
    await fs.statAsync(targetPath)
      .catch({ code: 'ENOENT' }, () => fs.writeFileAsync(targetPath, JSON.stringify([]), { encoding: 'utf8' }));
    return targetPath;
  } catch (err) {
    return Promise.reject(err);
  }
}

export function getPrefixOffset(api: types.IExtensionApi): number {
  const state = api.getState();
  const profileId = selectors.activeProfile(state)?.id;
  if (profileId === undefined) {
    // How ?
    api.showErrorNotification('No active profile for 7dtd', undefined, { allowReport: false });
    return;
  }

  return util.getSafe(state, ['settings', '7daystodie', 'prefixOffset', profileId], 0);
}

export function reversePrefix(input: string): number {
  if (input.length !== 3 || input.match(/[A-Z][A-Z][A-Z]/g) === null) {
    throw new util.DataInvalid('Invalid input, please provide a valid prefix (AAA-ZZZ)');
  }
  const prefix = input.split('');

  const offset = prefix.reduce((prev, iter, idx) => {
    const pow = 2 - idx;
    const mult = Math.pow(26, pow);
    const charCode = (iter.charCodeAt(0) % 65);
    prev = prev + (charCode * mult);
    return prev;
  }, 0);

  return offset;
}

export function makePrefix(input: number) {
  let res = '';
  let rest = input;
  while (rest > 0) {
    res = String.fromCharCode(65 + (rest % 26)) + res;
    rest = Math.floor(rest / 26);
  }
  return util.pad((res as any), 'A', 3);
}

export async function getModName(modInfoPath): Promise<any> {
  let modInfo;
  try {
    const xmlData = await fs.readFileAsync(modInfoPath);
    modInfo = await PARSER.parseStringPromise(xmlData);
    const modName = modInfo?.DisplayName?.[0]?.$?.value
      || modInfo?.ModInfo?.[0]?.Name?.[0]?.$?.value
      || modInfo?.Name?.[0]?.$?.value;
    return (modName !== undefined)
      ? Promise.resolve(modName)
      : Promise.reject(new util.DataInvalid('Unexpected modinfo.xml format'));
  } catch (err) {
    return Promise.reject(new util.DataInvalid('Failed to parse ModInfo.xml file'));
  }
}

export async function getModInfoFiles(basePath: string): Promise<string[]> {
  let filePaths: string[] = [];
  return turbowalk(basePath, files => {
    const filtered = files.filter(entry =>
      !entry.isDirectory && path.basename(entry.filePath) === MOD_INFO);
    filePaths = filePaths.concat(filtered.map(entry => entry.filePath));
  }, { recurse: true, skipLinks: true })
    .catch(err => ['ENOENT', 'ENOTFOUND'].includes(err.code)
      ? Promise.resolve() : Promise.reject(err))
    .then(() => Promise.resolve(filePaths));
}

export interface IAttribute extends IXmlNode<{ id: string, type: string, value: string }> { }
export interface IXmlNode<AttributeT extends object> {
  $: AttributeT;
}
export interface IModNameNode extends IXmlNode<{ id: 'Name' }> {
  attribute: IAttribute;
}
export interface IModInfoNode extends IXmlNode<{ id: 'ModInfo' }> {
  children?: [{ node: IModNameNode[] }];
  attribute?: IAttribute[];
}
