/* eslint-disable */
import * as path from 'path';
import * as semver from 'semver';
import { generate as shortid } from 'shortid';
import walk from 'turbowalk';
import { actions, fs, types, selectors, log, util } from 'vortex-api';
import { Builder, parseStringPromise } from 'xml2js';
import { DEBUG, MOD_TYPE_LSLIB, GAME_ID, DEFAULT_MOD_SETTINGS_V8, DEFAULT_MOD_SETTINGS_V7, DEFAULT_MOD_SETTINGS_V6 } from './common';
import { extractPak } from './divineWrapper';
import { IModSettings, IPakInfo, IModNode, IXmlNode, LOFormat } from './types';

export function getGamePath(api): string {
  const state = api.getState();
  return state.settings.gameMode.discovered?.[GAME_ID]?.path as string;
}

export function getGameDataPath(api) {
  const state = api.getState();
  const gamePath = state.settings.gameMode.discovered?.[GAME_ID]?.path;
  if (gamePath !== undefined) {
    return path.join(gamePath, 'Data');
  } else {
    return undefined;
  }
}

export function documentsPath() {
  return path.join(util.getVortexPath('localAppData'), 'Larian Studios', 'Baldur\'s Gate 3');
}

export function modsPath() {
  return path.join(documentsPath(), 'Mods');
}

export function profilesPath() {
  return path.join(documentsPath(), 'PlayerProfiles');
}

export async function globalProfilePath(api: types.IExtensionApi) {
  const bg3ProfileId = await getActivePlayerProfile(api);
  return path.join(documentsPath(), bg3ProfileId);
}

export const getPlayerProfiles = (() => {
  let cached = [];
  try {
    cached = (fs as any).readdirSync(profilesPath())
      .filter(name => (path.extname(name) === '') && (name !== 'Default'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
  return () => cached;
})();

export function gameSupportsProfile(gameVersion: string) {
  return semver.lt(semver.coerce(gameVersion), '4.1.206');
}

export async function getOwnGameVersion(state: types.IState): Promise<string> {
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  return await util.getGame(GAME_ID).getInstalledVersion(discovery);
}

export async function getActivePlayerProfile(api: types.IExtensionApi): Promise<string> {
  return gameSupportsProfile(await getOwnGameVersion(api.getState()))
    ? api.store.getState().settings.baldursgate3?.playerProfile || 'global'
    : 'Public';
}

export function parseModNode(node: IModNode) {
  const name = findNode(node.attribute, 'Name').$.value;
  return {
    id: name,
    name,
    data: findNode(node.attribute, 'UUID').$.value,
  };
}

const resolveMeta = (metadata?: any) => {
  return (metadata !== undefined)
    ? typeof metadata === 'string'
      ? metadata
      : JSON.stringify(metadata)
    : undefined;
}

export function logError(message: string, metadata?: any) {
  const meta = resolveMeta(metadata);
  log('debug', message, meta);
}

export function logDebug(message: string, metadata?: any) {
  if (DEBUG) {
    // so meta
    const meta = resolveMeta(metadata);
    log('debug', message, meta);
  }
}

export function forceRefresh(api: types.IExtensionApi) {
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  const action = {
    type: 'SET_FB_FORCE_UPDATE',
    payload: {
      profileId,
    },
  };
  api.store.dispatch(action);
}

export function findNode<T extends IXmlNode<{ id: string }>, U>(nodes: T[], id: string): T {
  return nodes?.find(iter => iter.$.id === id) ?? undefined;
}

export function getLatestInstalledLSLibVer(api: types.IExtensionApi) {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } =
    util.getSafe(state, ['persistent', 'mods', GAME_ID], {});

  return Object.keys(mods).reduce((prev, id) => {
    if (mods[id].type === 'bg3-lslib-divine-tool') {
      const arcId = mods[id].archiveId;
      const dl: types.IDownload = util.getSafe(state,
        ['persistent', 'downloads', 'files', arcId], undefined);
      const storedVer = util.getSafe(mods[id], ['attributes', 'version'], '0.0.0');

      try {
        if (semver.gt(storedVer, prev)) {
          prev = storedVer;
        }
      } catch (err) {
        log('warn', 'invalid version stored for lslib mod', { id, version: storedVer });
      }

      if (dl !== undefined) {
        // The LSLib developer doesn't always update the version on the executable
        //  itself - we're going to try to extract it from the archive which tends
        //  to use the correct version.
        const fileName = path.basename(dl.localPath, path.extname(dl.localPath));
        const idx = fileName.indexOf('-v');
        try {
          const ver = semver.coerce(fileName.slice(idx + 2)).version;
          if (semver.valid(ver) && ver !== storedVer) {
            api.store.dispatch(actions.setModAttribute(GAME_ID, id, 'version', ver));
            prev = ver;
          }
        } catch (err) {
          // We failed to get the version... Oh well.. Set a bogus version since
          //  we clearly have lslib installed - the update functionality should take
          //  care of the rest (when the user clicks the check for updates button)
          api.store.dispatch(actions.setModAttribute(GAME_ID, id, 'version', '1.0.0'));
          prev = '1.0.0';
        }
      }
    }
    return prev;
  }, '0.0.0');
}

let _FORMAT: LOFormat = null;
const PATCH_8 = '4.67.58';
const PATCH_7 = '4.58.49';
const PATCH_6 = '4.50.22';
export async function getDefaultModSettingsFormat(api: types.IExtensionApi): Promise<LOFormat> {
  if (_FORMAT !== null) {
    return _FORMAT;
  }
  _FORMAT = 'v8';
  try {
    const state = api.getState();
    const gameVersion = await getOwnGameVersion(state);
    const coerced = gameVersion ? semver.coerce(gameVersion) : PATCH_8;
    if (semver.gte(coerced, PATCH_8)) {
      _FORMAT = 'v8';
    } else if (semver.gte(coerced, PATCH_7)) {
      _FORMAT = 'v7';
    } else if (semver.gte(coerced, PATCH_6)) {
      _FORMAT = 'v6';
    } else {
      _FORMAT = 'pre-v6';
    }
  }
  catch (err) {
    log('warn', 'failed to get game version', err);
  }

  return _FORMAT;
}

export async function getDefaultModSettings(api: types.IExtensionApi): Promise<string> {
  if (_FORMAT === null) {
    _FORMAT = await getDefaultModSettingsFormat(api);
  }
  return {
    'v8': DEFAULT_MOD_SETTINGS_V8,
    'v7': DEFAULT_MOD_SETTINGS_V7,
    'v6': DEFAULT_MOD_SETTINGS_V6,
    'pre-v6': DEFAULT_MOD_SETTINGS_V6
  }[_FORMAT];
}

export async function convertToV8(someXml: string): Promise<string> {
  // Make sure we convert v6 to v7 first
  // This is a bit of a hack but meh.
  const v7Xml = await convertV6toV7(someXml);
  const v7Json = await parseStringPromise(v7Xml);
  v7Json.save.version[0].$.major = '4';
  v7Json.save.version[0].$.minor = '8';
  v7Json.save.version[0].$.revision = '0';
  v7Json.save.version[0].$.build = '10';

  const moduleSettingsChildren = v7Json.save.region[0].node[0].children[0].node;
  const modsNode = moduleSettingsChildren.find((n: any) => n.$.id === 'Mods');
  if (modsNode) {
    var gustavEntry = modsNode.children[0].node.find((n: any) => 
      n.attribute.some((attr: any) => attr.$.id === 'Name' && attr.$.value === 'GustavDev'));
    if (gustavEntry) {
      // This is the old Gustav Entry - we need to update it to the new one
      gustavEntry.attribute = [
        { $: { id: 'Folder', type: 'LSString', value: 'GustavX' } },
        { $: { id: 'MD5', type: 'LSString', value: '' } },
        { $: { id: 'Name', type: 'LSString', value: 'GustavX' } },
        { $: { id: 'PublishHandle', type: 'uint64', value: '0' } },
        { $: { id: 'UUID', type: 'guid', value: 'cb555efe-2d9e-131f-8195-a89329d218ea' } },
        { $: { id: 'Version64', type: 'int64', value: '36028797018963968' } }
      ];
    }
  }

  const builder = new Builder();
  const v8Xml = builder.buildObject(v7Json);

  return v8Xml;
}

export async function convertV6toV7(v6Xml: string): Promise<string> {
  const v6Json = await parseStringPromise(v6Xml);
  v6Json.save.version[0].$.major = '4';
  v6Json.save.version[0].$.minor = '7';
  v6Json.save.version[0].$.revision = '1';
  v6Json.save.version[0].$.build = '3';

  const moduleSettingsChildren = v6Json.save.region[0].node[0].children[0].node;
  const modOrderIndex = moduleSettingsChildren.findIndex((n: any) => n.$.id === 'ModOrder');
  if (modOrderIndex !== -1) {
    // Remove the 'ModOrder' node if it exists
    moduleSettingsChildren.splice(modOrderIndex, 1);
  }

  // Find the 'Mods' node to modify attributes
  const modsNode = moduleSettingsChildren.find((n: any) => n.$.id === 'Mods');

  if (modsNode) {
    for (let i = 0; i < modsNode.children[0].node.length; i++) {
      const moduleShortDescNode = modsNode.children[0].node[i];

      if (moduleShortDescNode) {
        // Update the 'UUID' attribute type from 'FixedString' to 'guid'
        const uuidAttribute = moduleShortDescNode.attribute.find((attr: any) => attr.$.id === 'UUID');
        if (uuidAttribute) {
          uuidAttribute.$.type = 'guid';
        }

        const publishHandleAtt = moduleShortDescNode.attribute.find((attr: any) => attr.$.id === 'PublishHandle');
        if (publishHandleAtt === undefined) {
          moduleShortDescNode.attribute.push({
            $: { id: 'publishHandle', type: 'uint64', value: '0' }
          })
        }

        // Might need to expand on this later (removing useless attributes, etc)
      } 
    }
  }

  const builder = new Builder();
  const v7Xml = builder.buildObject(v6Json);

  return v7Xml;
}

export function getLatestLSLibMod(api: types.IExtensionApi) {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } = state.persistent.mods[GAME_ID];
  if (mods === undefined) {
    log('warn', 'LSLib is not installed');
    return undefined;
  }
  const lsLib: types.IMod = Object.keys(mods).reduce((prev: types.IMod, id: string) => {
    if (mods[id].type === MOD_TYPE_LSLIB) {
      const latestVer = util.getSafe(prev, ['attributes', 'version'], '0.0.0');
      const currentVer = util.getSafe(mods[id], ['attributes', 'version'], '0.0.0');
      try {
        if (semver.gt(currentVer, latestVer)) {
          prev = mods[id];
        }
      } catch (err) {
        log('warn', 'invalid mod version', { modId: id, version: currentVer });
      }
    }
    return prev;
  }, undefined);

  if (lsLib === undefined) {
    log('warn', 'LSLib is not installed');
    return undefined;
  }

  return lsLib;
}

export async function extractPakInfoImpl(api: types.IExtensionApi, pakPath: string, mod: types.IMod, isListed: boolean): Promise<IPakInfo> {
  const meta = await extractMeta(api, pakPath, mod);
  const config = findNode(meta?.save?.region, 'Config');
  const configRoot = findNode(config?.node, 'root');
  const moduleInfo = findNode(configRoot?.children?.[0]?.node, 'ModuleInfo');

  const attr = (name: string, fallback: () => any) =>
    findNode(moduleInfo?.attribute, name)?.$?.value ?? fallback();

  const genName = path.basename(pakPath, path.extname(pakPath));

  return {
    author: attr('Author', () => 'Unknown'),
    description: attr('Description', () => 'Missing'),
    folder: attr('Folder', () => genName),
    md5: attr('MD5', () => ''),
    name: attr('Name', () => genName),
    type: attr('Type', () => 'Adventure'),
    uuid: attr('UUID', () => require('uuid').v4()),
    version: attr('Version64', () => '1'),
    publishHandle: attr('PublishHandle', () => '0'),
    isListed: isListed
  };
}

export async function extractMeta(api: types.IExtensionApi, pakPath: string, mod: types.IMod): Promise<IModSettings> {
  const metaPath = path.join(util.getVortexPath('temp'), 'lsmeta', shortid());
  await fs.ensureDirAsync(metaPath);
  await extractPak(api, pakPath, metaPath, '*/meta.lsx');
  try {
    // the meta.lsx may be in a subdirectory. There is probably a pattern here
    // but we'll just use it from wherever
    let metaLSXPath: string = path.join(metaPath, 'meta.lsx');
    await walk(metaPath, entries => {
      const temp = entries.find(e => path.basename(e.filePath).toLowerCase() === 'meta.lsx');
      if (temp !== undefined) {
        metaLSXPath = temp.filePath;
      }
    });
    const dat = await fs.readFileAsync(metaLSXPath);
    const meta = await parseStringPromise(dat);
    await fs.removeAsync(metaPath);
    return meta;
  } catch (err) {
    await fs.removeAsync(metaPath);
    if (err.code === 'ENOENT') {
      return Promise.resolve(undefined);
    } else if (err.message.includes('Column') && (err.message.includes('Line'))) {
      // an error message specifying column and row indicate a problem parsing the xml file
      api.sendNotification({
        type: 'warning',
        message: 'The meta.lsx file in "{{modName}}" is invalid, please report this to the author',
        actions: [{
          title: 'More',
          action: () => {
            api.showDialog('error', 'Invalid meta.lsx file', {
              message: err.message,
            }, [{ label: 'Close' }])
          }
        }],
        replace: {
          modName: util.renderModName(mod),
        }
      })
      return Promise.resolve(undefined);
    } else {
      throw err;
    }
  }
}

let storedLO = [];
export async function writeModSettings(api: types.IExtensionApi, data: IModSettings, bg3profile: string): Promise<void> {
  if (!bg3profile) {
    return;
  }

  const globalProfile = await globalProfilePath(api);
  const settingsPath = (bg3profile !== 'global')
    ? path.join(profilesPath(), bg3profile, 'modsettings.lsx')
    : path.join(globalProfile, 'modsettings.lsx');

  const builder = new Builder();
  const xml = builder.buildObject(data);
  try {
    await fs.ensureDirWritableAsync(path.dirname(settingsPath));
    await fs.writeFileAsync(settingsPath, xml);
  } catch (err) {
    storedLO = [];
    const allowReport = ['ENOENT', 'EPERM'].includes(err.code);
    api.showErrorNotification('Failed to write mod settings', err, { allowReport });
    return;
  }
}

export async function parseLSXFile(lsxPath: string): Promise<IModSettings> {
  const dat = await fs.readFileAsync(lsxPath, { encoding: 'utf8' });
  return parseStringPromise(dat);
}

export async function readModSettings(api: types.IExtensionApi): Promise<IModSettings> {
  const bg3profile: string = await getActivePlayerProfile(api);
  const playerProfiles = getPlayerProfiles();
  if (playerProfiles.length === 0) {
    storedLO = [];
    const settingsPath = path.join(profilesPath(), 'Public', 'modsettings.lsx');
    return parseLSXFile(settingsPath);
  }

  const globalProfile = await globalProfilePath(api);
  const settingsPath = (bg3profile !== 'global')
    ? path.join(profilesPath(), bg3profile, 'modsettings.lsx')
    : path.join(globalProfile, 'modsettings.lsx');
  return parseLSXFile(settingsPath);
}

export async function readStoredLO(api: types.IExtensionApi) {
  const modSettings = await readModSettings(api);
  const config = findNode(modSettings?.save?.region, 'ModuleSettings');
  const configRoot = findNode(config?.node, 'root');
  const modOrderRoot = findNode(configRoot?.children?.[0]?.node, 'ModOrder');
  const modsRoot = findNode(configRoot?.children?.[0]?.node, 'Mods');
  const modOrderNodes = modOrderRoot?.children?.[0]?.node ?? [];
  const modNodes = modsRoot?.children?.[0]?.node ?? [];
  const modOrder = modOrderNodes.map(node => findNode(node.attribute, 'UUID').$?.value);

  // return util.setSafe(state, ['settingsWritten', profile], { time, count });
  const state = api.store.getState();
  const vProfile = selectors.activeProfile(state);
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const enabled = Object.keys(mods).filter(id =>
    util.getSafe(vProfile, ['modState', id, 'enabled'], false));
  const bg3profile: string = state.settings.baldursgate3?.playerProfile;
  if (enabled.length > 0 && modNodes.length === 1) {
    const lastWrite = state.settings.baldursgate3?.settingsWritten?.[bg3profile];
    if ((lastWrite !== undefined) && (lastWrite.count > 1)) {
      api.showDialog('info', '"modsettings.lsx" file was reset', {
        text: 'The game reset the list of active mods and ran without them.\n'
          + 'This happens when an invalid or incompatible mod is installed. '
          + 'The game will not load any mods if one of them is incompatible, unfortunately '
          + 'there is no easy way to find out which one caused the problem.',
      }, [
        { label: 'Continue' },
      ]);
    }
  }

  storedLO = modNodes
    .map(node => parseModNode(node))
    // Gustav is the core game
    .filter(entry => !entry.id.startsWith('Gustav'))
    // sort by the index of each mod in the modOrder list
    .sort((lhs, rhs) => modOrder
      .findIndex(i => i === lhs.data) - modOrder.findIndex(i => i === rhs.data));
}