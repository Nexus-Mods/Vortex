/* eslint-disable */
import Bluebird from 'bluebird';
import { IQuery } from 'modmeta-db';
import React from 'react';
import * as semver from 'semver';
import turbowalk from 'turbowalk';
import { actions, fs, log, selectors, util, types } from 'vortex-api';
import * as winapi from 'winapi-bindings';
import CompatibilityIcon from './CompatibilityIcon';
import { SMAPI_QUERY_FREQUENCY } from './constants';

import DependencyManager from './DependencyManager';
import { installRootFolder, testRootFolder } from './installers/rootFolderInstaller';
import { installSMAPI, isSMAPIModType, SMAPI_EXE, testSMAPI } from './installers/smapiInstaller';
import { installStardewValley, MANIFEST_FILE, testSupported } from './installers/stardewValleyInstaller';
import sdvReducers from './reducers';
import SMAPIProxy from './smapiProxy';
import { testSMAPIOutdated } from './tests';
import { compatibilityOptions, CompatibilityStatus, ISMAPIResult } from './types';
import { parseManifest, defaultModsRelPath } from './util';

import Settings from './Settings';

import { setMergeConfigs } from './actions';

import { onAddedFiles, onRevertFiles, onWillEnableMods, registerConfigMod } from './configMod';

const path = require('path'),
  { clipboard } = require('electron'),
  { deploySMAPI, downloadSMAPI, findSMAPIMod } = require('./SMAPI'),
  { GAME_ID, MOD_TYPE_CONFIG } = require('./common');


function toBlue<T>(func: (...args: any[]) => Promise<T>): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

class StardewValley implements types.IGame {
  public context: types.IExtensionContext;
  public id: string = GAME_ID;
  public name: string = 'Stardew Valley';
  public logo: string = 'gameart.jpg';
  public requiredFiles: string[];
  public environment: { [key: string]: string } = {
    SteamAPPId: '413150',
  };
  public details: { [key: string]: any } = {
    steamAppId: 413150
  };
  public supportedTools: any[] = [
    {
      id: 'smapi',
      name: 'SMAPI',
      logo: 'smapi.png',
      executable: () => SMAPI_EXE,
      requiredFiles: [SMAPI_EXE],
      shell: true,
      exclusive: true,
      relative: true,
      defaultPrimary: true,
    }
  ];
  public mergeMods: boolean = true;
  public requiresCleanup: boolean = true;
  public shell: boolean = process.platform === 'win32';
  public defaultPaths: string[];

  /*********
  ** Vortex API
  *********/
  /**
   * Construct an instance.
   * @param {IExtensionContext} context -- The Vortex extension context.
   */
  constructor(context: types.IExtensionContext) {
    // properties used by Vortex
    this.context = context;
    this.requiredFiles = process.platform == 'win32'
      ? ['Stardew Valley.exe']
      : ['StardewValley'];

    // custom properties
    this.defaultPaths = [
      // Linux
      process.env.HOME + '/GOG Games/Stardew Valley/game',
      process.env.HOME + '/.local/share/Steam/steamapps/common/Stardew Valley',

      // Mac
      '/Applications/Stardew Valley.app/Contents/MacOS',
      process.env.HOME + '/Library/Application Support/Steam/steamapps/common/Stardew Valley/Contents/MacOS',

      // Windows
      'C:\\Program Files (x86)\\GalaxyClient\\Games\\Stardew Valley',
      'C:\\Program Files (x86)\\GOG Galaxy\\Games\\Stardew Valley',
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stardew Valley'
    ];
  }

  /**
   * Asynchronously find the game install path.
   *
   * This function should return quickly and, if it returns a value, it should definitively be the
   * valid game path. Usually this function will query the path from the registry or from steam.
   * This function may return a promise and it should do that if it's doing I/O.
   *
   * This may be left undefined but then the tool/game can only be discovered by searching the disk
   * which is slow and only happens manually.
   */
  public queryPath = toBlue<string>(async () => {
    // check known game stores first
    const game = await util.GameStoreHelper.findByAppId([
      '413150',
      '1453375253',
      'ConcernedApe.StardewValleyPC',
    ]).catch(() => undefined);

    if (game !== undefined) {
      return game.gamePath;
    }

    // then check fallback default paths
    for (const defaultPath of this.defaultPaths) {
      if (await this.getPathExistsAsync(defaultPath)) {
        return defaultPath;
      }
    }

    throw new Error('Stardew Valley install path not found');
  });

  /**
   * Get the path of the tool executable relative to the tool base path, i.e. binaries/UT3.exe or
   * TESV.exe. This is a function so that you can return different things based on the operating
   * system for example but be aware that it will be evaluated at application start and only once,
   * so the return value can not depend on things that change at runtime.
   */
  public executable() {
    return process.platform == 'win32'
      ? 'Stardew Valley.exe'
      : 'StardewValley';
  }

  /**
   * Get the default directory where mods for this game should be stored.
   * 
   * If this returns a relative path then the path is treated as relative to the game installation
   * directory. Simply return a dot ( () => '.' ) if mods are installed directly into the game
   * directory.
   */ 
  public queryModPath()
  {
    return defaultModsRelPath();
  }

  /**
   * Optional setup function. If this game requires some form of setup before it can be modded (like
   * creating a directory, changing a registry key, ...) do it here. It will be called every time
   * before the game mode is activated.
   * @param {IDiscoveryResult} discovery -- basic info about the game being loaded.
   */
  public setup = toBlue(async (discovery) => {
    // Make sure the folder for SMAPI mods exists.
    try {
      await fs.ensureDirWritableAsync(path.join(discovery.path, defaultModsRelPath()));
    } catch (err) {
      return Promise.reject(err);
    }
    // skip if SMAPI found
    const smapiPath = path.join(discovery.path, SMAPI_EXE);
    const smapiFound = await this.getPathExistsAsync(smapiPath);
    if (!smapiFound) {
      this.recommendSmapi();
    }
    
    const state = this.context.api.getState();

    /*
    if (state.settings['SDV'].useRecommendations === undefined) {
      this.context.api.showDialog('question', 'Show Recommendations?', {
        text: 'Vortex can optionally use data from SMAPI\'s database and '
            + 'the manifest files included with mods to recommend additional '
            + 'compatible mods that work with those that you have installed. '
            + 'In some cases, this information could be wrong or incomplete '
            + 'which may lead to unreliable prompts showing in the app.\n'
            + 'All recommendations shown should be carefully considered '
            + 'before accepting them - if you are unsure please check the '
            + 'mod page to see if the author has provided any further instructions. '
            + 'Would you like to enable this feature? You can update your choice '
            + 'from the Settings menu at any time.'
      }, [
        { label: 'Continue without recommendations', action: () => {
          this.context.api.store.dispatch(setRecommendations(false));
        } },
        { label: 'Enable recommendations', action: () => {
          this.context.api.store.dispatch(setRecommendations(true));
        } },
      ])
    }*/
  });


  private recommendSmapi() {
    const smapiMod = findSMAPIMod(this.context.api);
    const title = smapiMod ? 'SMAPI is not deployed' : 'SMAPI is not installed';
    const actionTitle = smapiMod ? 'Deploy' : 'Get SMAPI';
    const action = () => (smapiMod
      ? deploySMAPI(this.context.api)
      : downloadSMAPI(this.context.api))
      .then(() => this.context.api.dismissNotification?.('smapi-missing'));

    this.context.api.sendNotification?.({
      id: 'smapi-missing',
      type: 'warning',
      title,
      message: 'SMAPI is required to mod Stardew Valley.',
      actions: [
        {
          title: actionTitle,
          action,
        },
      ]
    });
  }

  /*********
  ** Internal methods
  *********/

  /**
   * Asynchronously check whether a file or directory path exists.
   * @param {string} path - The file or directory path.
   */
  async getPathExistsAsync(path)
  {
    try {
     await fs.statAsync(path);
     return true;
    }
    catch(err) {
      return false;
    }
  }

  /**
   * Asynchronously read a registry key value.
   * @param {string} hive - The registry hive to access. This should be a constant like Registry.HKLM.
   * @param {string} key - The registry key.
   * @param {string} name - The name of the value to read.
   */
  async readRegistryKeyAsync(hive, key, name)
  {
    try {
      const instPath = winapi.RegGetValue(hive, key, name);
      if (!instPath) {
        throw new Error('empty registry key');
      }
      return Promise.resolve(instPath.value);
    } catch (err) {
      return Promise.resolve(undefined);
    }
  }
}

async function showSMAPILog(api, basePath, logFile) {
  const logData = await fs.readFileAsync(path.join(basePath, logFile), { encoding: 'utf-8' });
  await api.showDialog('info', 'SMAPI Log', {
    text: 'Your SMAPI log is displayed below. To share it, click "Copy & Share" which will copy it to your clipboard and open the SMAPI log sharing website. ' +
      'Next, paste your code into the text box and press "save & parse log". You can now share a link to this page with others so they can see your log file.\n\n' + logData
  }, [{
    label: 'Copy & Share log', action: () => {
      const timestamp = new Date().toISOString().replace(/^.+T([^\.]+).+/, '$1');
      clipboard.writeText(`[${timestamp} INFO Vortex] Log exported by Vortex ${util.getApplication().version}.\n` + logData);
      return util.opn('https://smapi.io/log').catch(err => undefined);
    }
  }, { label: 'Close', action: () => undefined }]);
}

async function onShowSMAPILog(api) {
  //Read and display the log.
  const basePath = path.join(util.getVortexPath('appData'), 'stardewvalley', 'errorlogs');
  try {
    //If the crash log exists, show that.
    await showSMAPILog(api, basePath, "SMAPI-crash.txt");
  } catch (err) {
    try {
      //Otherwise show the normal log.
      await showSMAPILog(api, basePath, "SMAPI-latest.txt");
    } catch (err) {
      //Or Inform the user there are no logs.
      api.sendNotification?.({ type: 'info', title: 'No SMAPI logs found.', message: '', displayMS: 5000 });
    }
  }
}

function getModManifests(modPath?: string): Promise<string[]> {
  const manifests: string[] = [];

  if (modPath === undefined) {
    return Promise.resolve([]);
  }

  return turbowalk(modPath, async entries => {
    for (const entry of entries) {
      if (path.basename(entry.filePath) === 'manifest.json') {
        manifests.push(entry.filePath);
      }
    }
  }, { skipHidden: false, recurse: true, skipInaccessible: true, skipLinks: true })
    .then(() => manifests);
}

function updateConflictInfo(api: types.IExtensionApi,
                            smapi: SMAPIProxy,
                            gameId: string,
                            modId: string)
                            : Promise<void> {
  const mod = util.getSafe(api.getState(), ['persistent', 'mods', gameId, modId], undefined as any);

  if (mod === undefined) {
    return Promise.resolve();
  }

  const now = Date.now();
  const store = api.store;
  if (store === undefined) {
    return Promise.resolve();
  }

  if ((now - (mod.attributes?.lastSMAPIQuery ?? 0)) < SMAPI_QUERY_FREQUENCY) {
    return Promise.resolve();
  }

  let additionalLogicalFileNames = mod.attributes?.additionalLogicalFileNames;
  if (!additionalLogicalFileNames) {
    if (mod.attributes?.logicalFileName) {
      additionalLogicalFileNames = [mod.attributes?.logicalFileName];
    } else {
      additionalLogicalFileNames = [];
    }
  }

  const query = additionalLogicalFileNames
    .map(name => {
      const res = {
        id: name,
      };
      const ver = mod.attributes?.manifestVersion
                     ?? semver.coerce(mod.attributes?.version)?.version;
      if (!!ver) {
        res['installedVersion'] = ver;
      }

      return res;
    });

  const stat = (item: ISMAPIResult): CompatibilityStatus => {
    const status = item.metadata?.compatibilityStatus?.toLowerCase?.();
    if (!compatibilityOptions.includes(status as any)) {
      return 'unknown';
    } else {
      return status as CompatibilityStatus;
    }
  };

  const compatibilityPrio = (item: ISMAPIResult) => compatibilityOptions.indexOf(stat(item));

  return smapi.findByNames(query)
    .then(results => {
      const worstStatus: ISMAPIResult[] = results
        .sort((lhs, rhs) => compatibilityPrio(lhs) - compatibilityPrio(rhs));
      const worst = worstStatus[0];
      if (worst !== undefined) {
        store.dispatch(actions.setModAttributes(gameId, modId, {
          lastSMAPIQuery: now,
          compatibilityStatus: worst.metadata?.compatibilityStatus,
          compatibilityMessage: worst.metadata?.compatibilitySummary,
          compatibilityUpdate: worst.suggestedUpdate?.version,
        }));
      } else {
        log('debug', 'no manifest');
        store.dispatch(actions.setModAttribute(gameId, modId, 'lastSMAPIQuery', now));
      }
    })
    .catch(err => {
      log('warn', 'error reading manifest', errorMessage(err));
      store.dispatch(actions.setModAttribute(gameId, modId, 'lastSMAPIQuery', now));
    });
}

function init(context: types.IExtensionContext) {
  let dependencyManager: DependencyManager;

  const getDiscoveryPath = (): string => {
    const state = context.api.getState();
    const discoveryPath = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
    if (discoveryPath === undefined) {
      // should never happen and if it does it will cause errors elsewhere as well
      log('error', 'stardewvalley was not discovered');
      throw new Error('Stardew Valley was not discovered');
    }

    return discoveryPath;
  }

  const getSMAPIPath = (game) => {
    const state = context.api.getState();
    return util.getSafe(state, ['settings', 'gameMode', 'discovered', game.id, 'path'], '');
  };

  const manifestExtractor = toBlue(
    async (modInfo: any, modPath?: string): Promise<{ [key: string]: any; }> => {
      if (selectors.activeGameId(context.api.getState()) !== GAME_ID) {
        return Promise.resolve({});
      }

      const manifests = await getModManifests(modPath);

      const parsedManifests = (await Promise.all(manifests.map(
        async manifest => {
          try {
            return await parseManifest(manifest);
          } catch (err) {
            log('warn', 'Failed to parse manifest', { manifestFile: manifest, error: errorMessage(err) });
            return undefined;
          }
        }))).filter(manifest => manifest !== undefined);

      if (parsedManifests.length === 0) {
        return Promise.resolve({});
      }

      // we can only use one manifest to get the id from
      const refManifest = parsedManifests[0];

      const additionalLogicalFileNames = parsedManifests
        .filter(manifest => manifest.UniqueID !== undefined)
        .map(manifest => manifest.UniqueID.toLowerCase());

      const minSMAPIVersion = parsedManifests
        .map(manifest => manifest.MinimumApiVersion)
        .filter(version => semver.valid(version))
        .sort((lhs, rhs) => semver.compare(rhs, lhs))[0];

      const result = {
        additionalLogicalFileNames,
        minSMAPIVersion,
      };

      if (refManifest !== undefined) {
        // don't set a custom file name for SMAPI
        if (modInfo.download.modInfo?.nexus?.ids?.modId !== 2400) {
          result['customFileName'] = refManifest.Name;
        }

        if (typeof (refManifest.Version) === 'string') {
          result['manifestVersion'] = refManifest.Version;
        }
      }

      return Promise.resolve(result);
    });

  context.registerGame(new StardewValley(context));
  context.registerReducer(['settings', 'SDV'], sdvReducers);

  context.registerSettings('Mods', Settings, () => ({
    onMergeConfigToggle: async (profileId: string, enabled: boolean) => {
      if (!enabled) {
        await onRevertFiles(context.api, profileId);
        context.api.sendNotification?.({ type: 'info', message: 'Mod configs returned to their respective mods', displayMS: 5000 });
      }
      context.api.store?.dispatch(setMergeConfigs(profileId, enabled));
      return Promise.resolve();
    }
  }), () => selectors.activeGameId(context.api.getState()) === GAME_ID, 150);

  // Register our SMAPI mod type and installer. Note: This currently flags an error in Vortex on installing correctly.
  context.registerInstaller('smapi-installer', 30, testSMAPI, (files, dest) => Bluebird.resolve(installSMAPI(getDiscoveryPath, files, dest)));
  context.registerInstaller('sdvrootfolder', 50, testRootFolder, installRootFolder);
  context.registerInstaller('stardew-valley-installer', 50, testSupported,
    (files, destinationPath) => Bluebird.resolve(installStardewValley(context.api, dependencyManager, files, destinationPath)));

  context.registerModType('SMAPI', 30, gameId => gameId === GAME_ID, getSMAPIPath, isSMAPIModType);
  context.registerModType(MOD_TYPE_CONFIG, 30, (gameId) => (gameId === GAME_ID),
    () => path.join(getDiscoveryPath(), defaultModsRelPath()), () => Bluebird.resolve(false));
  context.registerModType('sdvrootfolder', 25, (gameId) => (gameId === GAME_ID),
    () => getDiscoveryPath(), (instructions) => {
      // Only interested in copy instructions.
      const copyInstructions = instructions.filter(instr => instr.type === 'copy');
      // This is a tricky pattern so we're going to 1st present the different packaging
      //  patterns we need to cater for:
      //  1. Replacement mod with "Content" folder. Does not require SMAPI so no
      //    manifest files are included.
      //  2. Replacement mod with "Content" folder + one or more SMAPI mods included
      //    alongside the Content folder inside a "Mods" folder.
      //  3. A regular SMAPI mod with a "Content" folder inside the mod's root dir.
      //
      // pattern 1:
      //  - Ensure we don't have manifest files
      //  - Ensure we have a "Content" folder
      //
      // To solve patterns 2 and 3 we're going to:
      //  Check whether we have any manifest files, if we do, we expect the following
      //    archive structure in order for the modType to function correctly:
      //    archive.zip =>
      //      ../Content/
      //      ../Mods/
      //      ../Mods/A_SMAPI_MOD\manifest.json
      const hasManifest = copyInstructions.some(instr =>
        instr.destination?.endsWith(MANIFEST_FILE) === true);
      const hasModsFolder = copyInstructions.some(instr =>
        instr.destination?.startsWith(defaultModsRelPath() + path.sep) === true);
      const hasContentFolder = copyInstructions.some(instr =>
        instr.destination?.startsWith('Content' + path.sep) === true);

      return (hasManifest)
        ? Bluebird.resolve(hasContentFolder && hasModsFolder)
        : Bluebird.resolve(hasContentFolder);
    });

  registerConfigMod(context)
  context.registerAction('mod-icons', 999, 'changelog', {}, 'SMAPI Log',
    () => { onShowSMAPILog(context.api); },
    () => {
      //Only show the SMAPI log button for SDV. 
      const state = context.api.getState();
      const gameMode = selectors.activeGameId(state);
      return (gameMode === GAME_ID);
    });

  context.registerAttributeExtractor(25, manifestExtractor);

  context.registerTableAttribute('mods', {
    id: 'sdv-compatibility',
    position: 100,
    condition: () => selectors.activeGameId(context.api.getState()) === GAME_ID,
    placement: 'table',
    calc: (mod: types.IMod) => mod.attributes?.compatibilityStatus,
    customRenderer: (mod: types.IMod, detailCell: boolean, t: types.TFunction) => {
      return React.createElement(CompatibilityIcon,
                                 { t, mod, detailCell }, []);
    },
    name: 'Compatibility',
    isDefaultVisible: true,
    edit: {},
  });

  /*
  context.registerTest('sdv-missing-dependencies', 'gamemode-activated',
    () => testMissingDependencies(context.api, dependencyManager));
  */
  context.registerTest('sdv-incompatible-mods', 'gamemode-activated',
    () => Bluebird.resolve(testSMAPIOutdated(context.api, dependencyManager)));

  context.once(() => {
    const proxy = new SMAPIProxy(context.api);
    context.api.setStylesheet('sdv', path.join(__dirname, 'sdvstyle.scss'));

    context.api.addMetaServer('smapi.io', {
      url: '',
      loopbackCB: (query: IQuery) => {
        return Bluebird.resolve(proxy.find(query))
          .catch(err => {
            log('error', 'failed to look up smapi meta info', errorMessage(err));
            return Bluebird.resolve([]);
          });
      },
      cacheDurationSec: 86400,
      priority: 25,
    });
    dependencyManager = new DependencyManager(context.api);
    context.api.onAsync('added-files', (profileId: string, files: any[]) => onAddedFiles(context.api, profileId, files) as any);

    context.api.onAsync('will-enable-mods', (profileId: string, modIds: string[], enabled: boolean, options: any) => onWillEnableMods(context.api, profileId, modIds, enabled, options) as any);

    context.api.onAsync('did-deploy', async (profileId) => {
      const state = context.api.getState();
      const profile = selectors.profileById(state, profileId);
      if (profile?.gameId !== GAME_ID) {
        return Promise.resolve();
      }

      const smapiMod = findSMAPIMod(context.api);
      const primaryTool = util.getSafe(state, ['settings', 'interface', 'primaryTool', GAME_ID], undefined);
      if (smapiMod && primaryTool === undefined) {
        context.api.store?.dispatch(actions.setPrimaryTool(GAME_ID, 'smapi'));
      }

      return Promise.resolve();
    })

    context.api.onAsync('did-purge', async (profileId) => {
      const state = context.api.getState();
      const profile = selectors.profileById(state, profileId);
      if (profile?.gameId !== GAME_ID) {
        return Promise.resolve();
      }

      const smapiMod = findSMAPIMod(context.api);
      const primaryTool = util.getSafe(state, ['settings', 'interface', 'primaryTool', GAME_ID], undefined);
      if (smapiMod && primaryTool === 'smapi') {
        context.api.store?.dispatch(actions.setPrimaryTool(GAME_ID, undefined as any));
      }

      return Promise.resolve();
    });

    context.api.events.on('did-install-mod', (gameId: string, archiveId: string, modId: string) => {
      if (gameId !== GAME_ID) {
        return;
      }
      updateConflictInfo(context.api, proxy, gameId, modId)
        .then(() => log('debug', 'added compatibility info', { modId }))
        .catch(err => log('error', 'failed to add compatibility info', { modId, error: errorMessage(err) }));

    });

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      if (gameMode !== GAME_ID) {
        return;
      }

      const state = context.api.getState();
      log('debug', 'updating SDV compatibility info');
      Promise.all(Object.keys(state.persistent.mods[gameMode] ?? {}).map(modId =>
        updateConflictInfo(context.api, proxy, gameMode, modId)))
        .then(() => {
          log('debug', 'done updating compatibility info');
        })
        .catch(err => {
          log('error', 'failed to update conflict info', errorMessage(err));
        });
    });
  });
}

export default init;
