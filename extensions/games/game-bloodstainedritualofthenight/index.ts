import path from 'path';
import { fs, log, selectors, types, util } from 'vortex-api';

import { GAME_ID, MOD_FILE_EXT, modsRelPath } from './common';
import { deserialize, serialize, validate } from './loadOrder';
import { migrate100 } from './migrations';
import { ILoadOrderEntry, IProps, LoadOrder } from './types';
import { genProps, getPakFiles, toBlue } from './util';

const STEAM_ID = '692850';
const EPIC_ID = 'a2ac59c83b704e40b4ab3a9e963fef52';

async function findGame() {
  return util.GameStoreHelper.findByAppId([STEAM_ID, EPIC_ID])
    .then(game => game.gamePath);
}

async function externalFilesWarning(api: types.IExtensionApi, externalMods: string[]) {
  const t = api.translate;
  if (externalMods.length === 0) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve, reject) => {
    api.showDialog('info', 'External Mod Files Detected', {
      bbcode: t('Vortex has discovered the following unmanaged/external files in the '
        + 'the game\'s mods directory:[br][/br][br][/br]{{files}}'
        + '[br][/br]Please note that the existence of these mods interferes with Vortex\'s '
        + 'load ordering functionality and as such, they should be removed using the same '
        + 'medium through which they have been added.[br][/br][br][/br]'
        + 'Alternatively, Vortex can try to import these files into its mods list which will '
        + 'allow Vortex to take control over them and display them inside the load ordering page. '
        + 'Vortex\'s load ordering functionality will not display external mod entries unless imported!',
        { replace: { files: externalMods.map(mod => `"${mod}"`).join('[br][/br]') } }),
    }, [
      { label: 'Close', action: () => reject(new util.UserCanceled()) },
      { label: 'Import External Mods', action: () => resolve(undefined) },
    ]);
  });
}

async function ImportExternalMods(api: types.IExtensionApi, external: string[]) {
  const state = api.getState();
  const downloadsPath = selectors.downloadPathForGame(state, GAME_ID);
  const szip = new util.SevenZip();
  for (const modFile of external) {
    const archivePath = path.join(downloadsPath, path.basename(modFile, MOD_FILE_EXT) + '.zip');
    try {
      await szip.add(archivePath, [ modFile ], { raw: ['-r'] });
      await fs.removeAsync(modFile);
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

async function prepareForModding(context: types.IExtensionContext,
                                 discovery: types.IDiscoveryResult) {
  const state = context.api.getState();
  const modsPath = path.join(discovery.path, modsRelPath());
  try {
    await fs.ensureDirWritableAsync(modsPath);
    const installPath = selectors.installPathForGame(state, GAME_ID);
    const managedFiles = await getPakFiles(installPath);
    const deployedFiles = await getPakFiles(modsPath);
    const modifier = (filePath) => path.basename(filePath).toLowerCase();
    const unManagedPredicate = (filePath: string) =>
      managedFiles.find(managed => modifier(managed) === modifier(filePath)) === undefined;
    const externalMods = deployedFiles.filter(unManagedPredicate);
    try {
      await externalFilesWarning(context.api, externalMods);
      await ImportExternalMods(context.api, externalMods);
    } catch (err) {
      if (err instanceof util.UserCanceled) {
        // nop
      } else {
        return Promise.reject(err);
      }
    }
  } catch (err) {
    return Promise.reject(err);
  }
}

function installContent(files) {
  const modFile = files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT);
  const idx = modFile.indexOf(path.basename(modFile));
  const rootPath = path.dirname(modFile);

  // Remove directories and anything that isn't in the rootPath.
  const filtered = files.filter(file =>
    ((file.indexOf(rootPath) !== -1)
    && (!file.endsWith(path.sep))));

  const instructions = filtered.map(file => {
    return {
      type: 'copy',
      source: file,
      destination: path.join(file.substr(idx)),
    };
  });

  return Promise.resolve({ instructions });
}

function testSupportedContent(files, gameId) {
  // Make sure we're able to support this mod.
  let supported = (gameId === GAME_ID) &&
    (files.find(file => path.extname(file).toLowerCase() === MOD_FILE_EXT) !== undefined);

  if (supported && files.find(file =>
      (path.basename(file).toLowerCase() === 'moduleconfig.xml')
      && (path.basename(path.dirname(file)).toLowerCase() === 'fomod'))) {
    supported = false;
  }

  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function toLOPrefix(context: types.IExtensionContext, mod: types.IMod): string {
  const props: IProps = genProps(context);
  if (props === undefined) {
    return 'ZZZZ-' + mod.id;
  }

  // Retrieve the load order as stored in Vortex's application state.
  const loadOrder = util.getSafe(props.state, ['persistent', 'loadOrder', props.profile.id], []);

  // Find the mod entry in the load order state and insert the prefix in front
  //  of the mod's name/id/whatever
  const loEntry: ILoadOrderEntry = loadOrder.find(loEntry => loEntry.id === mod.id);
  return (loEntry?.data?.prefix !== undefined)
    ? loEntry.data.prefix + '-' + mod.id
    : 'ZZZZ-' + mod.id;
}

async function requiresLauncher(gamePath: string, store?: string) {
 if (store === 'epic') {
    return Promise.resolve({
        launcher: 'epic',
        addInfo: {
            appId: EPIC_ID,
        },
    });
  }
  return Promise.resolve(undefined);
}

function main(context: types.IExtensionContext) {
  context.registerGame({
    id: GAME_ID,
    name: 'Bloodstained:\tRitual of the Night',
    mergeMods: (mod) => toLOPrefix(context, mod),
    queryPath: toBlue(findGame),
    requiresCleanup: true,
    supportedTools: [],
    queryModPath: () => modsRelPath(),
    logo: 'gameart.jpg',
    executable: () => 'BloodstainedROTN.exe',
    requiredFiles: [
      'BloodstainedRotN.exe',
      'BloodstainedROTN/Binaries/Win64/BloodstainedRotN-Win64-Shipping.exe',
    ],
    setup: toBlue((discovery) => prepareForModding(context, discovery)),
    requiresLauncher: requiresLauncher as any,
    environment: {
      SteamAPPId: STEAM_ID,
    },
    details: {
      steamAppId: +STEAM_ID,
      hashFiles: [
        'BloodstainedRotN.exe',
        'BloodstainedROTN/Binaries/Win64/BloodstainedRotN-Win64-Shipping.exe'
      ],
    },
  });

  context.registerLoadOrder({
    deserializeLoadOrder: () => deserialize(context),
    serializeLoadOrder: (loadOrder) => serialize(context, loadOrder),
    validate,
    gameId: GAME_ID,
    toggleableEntries: false,
    usageInstructions: 'Drag and drop the mods on the left to reorder them. BloodstainedROTN loads mods in alphabetic order so Vortex prefixes '
      + 'the directory names with "AAA, AAB, AAC, ..." to ensure they load in the order you set here.',
  });

  context.registerInstaller('bloodstainedrotn-mod', 25,
    toBlue(testSupportedContent), toBlue(installContent));

  context.registerMigration(toBlue(oldVer => migrate100(context.api, oldVer)));

  return true;
}

module.exports = {
  default: main,
};
