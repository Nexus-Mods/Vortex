import { addLocalDownload, removeDownload, setDownloadHashByFile,
         setDownloadModInfo,
         startActivity, stopActivity } from '../../actions';
import { showDialog } from '../../actions/notifications';
import { ICheckbox, IDialogResult } from '../../types/IDialog';
import { IExtensionApi, ThunkStore } from '../../types/IExtensionContext';
import {IProfile, IState} from '../../types/IState';
import { fileMD5 } from '../../util/checksum';
import ConcurrencyLimiter from '../../util/ConcurrencyLimiter';
import { DataInvalid, NotFound, ProcessCanceled, SetupError, TemporaryError,
         UserCanceled } from '../../util/CustomErrors';
import { createErrorReport, didIgnoreError,
        isOutdated, withContext } from '../../util/errorHandling';
import * as fs from '../../util/fs';
import getNormalizeFunc, { Normalize } from '../../util/getNormalizeFunc';
import lazyRequire from '../../util/lazyRequire';
import { log } from '../../util/log';
import { prettifyNodeErrorMessage } from '../../util/message';
import { activeProfile, downloadPathForGame, installPathForGame, knownGames } from '../../util/selectors';
import { getSafe, setSafe } from '../../util/storeHelper';
import { batchDispatch, isPathValid, setdefault, toPromise, truthy } from '../../util/util';
import walk from '../../util/walk';

import calculateFolderSize from '../../util/calculateFolderSize';

import { resolveCategoryId } from '../category_management/util/retrieveCategoryPath';
import { AlreadyDownloaded, DownloadIsHTML } from '../download_management/DownloadManager';
import { IDownload } from '../download_management/types/IDownload';
import { DOWNLOADS_DIR_TAG } from '../download_management/util/downloadDirectory';
import getDownloadGames from '../download_management/util/getDownloadGames';

import { IModType } from '../gamemode_management/types/IModType';
import { getGame } from '../gamemode_management/util/getGame';
import modName, { renderModReference } from '../mod_management/util/modName';
import { convertGameIdReverse } from '../nexus_integration/util/convertGameId';
import { setModEnabled, setModsEnabled } from '../profile_management/actions/profiles';

import {addModRule, removeModRule, setFileOverride, setINITweakEnabled, setModAttribute,
        setModAttributes,
        setModType} from './actions/mods';
import {Dependency, IDependency, IDependencyError, IModInfoEx} from './types/IDependency';
import { IInstallContext } from './types/IInstallContext';
import { IInstallResult, IInstruction, InstructionType } from './types/IInstallResult';
import { IFileListItem, IMod, IModReference, IModRule } from './types/IMod';
import { IModInstaller, ISupportedInstaller } from './types/IModInstaller';
import { InstallFunc } from './types/InstallFunc';
import { ISupportedResult, TestSupported } from './types/TestSupported';
import gatherDependencies, { findDownloadByRef, findModByRef, lookupFromDownload } from './util/dependencies';
import filterModInfo from './util/filterModInfo';
import metaLookupMatch from './util/metaLookupMatch';
import queryGameId from './util/queryGameId';
import testModReference, { idOnlyRef, isFuzzyVersion, referenceEqual } from './util/testModReference';

import InstallContext from './InstallContext';
import makeListInstaller from './listInstaller';
import deriveModInstallName from './modIdManager';
import { STAGING_DIR_TAG } from './stagingDirectory';

import { HTTPError } from '@nexusmods/nexus-api';
import Promise from 'bluebird';
import * as _ from 'lodash';
import { IHashResult, ILookupResult, IReference, IRule } from 'modmeta-db';
import Zip = require('node-7z');
import * as os from 'os';
import * as path from 'path';
import * as Redux from 'redux';
import * as url from 'url';

import * as modMetaT from 'modmeta-db';

import { generate as shortid } from 'shortid';

const {genHash} = lazyRequire<typeof modMetaT>(() => require('modmeta-db'));

export class ArchiveBrokenError extends Error {
  constructor(message: string) {
    super(`Archive is broken: ${message}`);

    this.name = this.constructor.name;
  }
}

interface IReplaceChoice {
  id: string;
  variant: string;
  enable: boolean;
  attributes: { [key: string]: any };
  rules: IRule[];
}

interface IInvalidInstruction {
  type: InstructionType;
  error: string;
}

class InstructionGroups {
  public copy: IInstruction[] = [];
  public mkdir: IInstruction[] = [];
  public submodule: IInstruction[] = [];
  public generatefile: IInstruction[] = [];
  public iniedit: IInstruction[] = [];
  public unsupported: IInstruction[] = [];
  public attribute: IInstruction[] = [];
  public setmodtype: IInstruction[] = [];
  public error: IInstruction[] = [];
  public rule: IInstruction[] = [];
  public enableallplugins: IInstruction[] = [];
}

export const INI_TWEAKS_PATH = 'Ini Tweaks';

export const INSTALL_ACTION = 'Update current profile';
export const REPLACE_ACTION = 'Update all profiles';
export const VARIANT_ACTION = 'Add Variant';

const archiveExtLookup = new Set<string>([
  '.zip', '.z01', '.7z', '.rar', '.r00', '.001', '.bz2', '.bzip2', '.gz', '.gzip',
  '.xz', '.z', '.lzh',
]);

// file types supported by 7z but we don't want to extract
// I was tempted to put .exe in here but there may actually be cases where the
// exe is a self-extracting archive and we would be able to handle it
const FILETYPES_AVOID = ['.dll'];

function nop() {
  // nop
}

/**
 * central class for the installation process
 *
 * @class InstallManager
 */
class InstallManager {
  private mInstallers: IModInstaller[] = [];
  private mGetInstallPath: (gameId: string) => string;
  private mTask: Zip;
  private mQueue: Promise<void>;
  private mDependencyInstalls: { [modId: string]: () => void } = {};
  private mDependencyDownloadsLimit: ConcurrencyLimiter =
    new ConcurrencyLimiter(3);
  private mDependencyInstallsLimit: ConcurrencyLimiter =
    new ConcurrencyLimiter(1);

  constructor(api: IExtensionApi, installPath: (gameId: string) => string) {
    this.mGetInstallPath = installPath;
    this.mQueue = Promise.resolve();

    api.onAsync('install-from-dependencies',
        (dependentId: string, rules: IModRule[], recommended: boolean) => {
      const profile = activeProfile(api.getState());
      if (profile === undefined) {
        return Promise.reject(new ProcessCanceled('No game active'));
      }
      const { mods } = api.getState().persistent;
      const collection = mods[profile.gameId]?.[dependentId];

      if (collection === undefined) {
        return Promise.resolve();
      }

      const instPath = this.mGetInstallPath(profile.gameId);

      const filtered = rules.filter(iter =>
        collection.rules.find(rule => _.isEqual(iter, rule)) !== undefined);

      if (recommended) {
        return this.installRecommendationsImpl(api, profile, profile.gameId, dependentId,
          modName(collection), filtered, instPath, true);
      } else {
        return this.installDependenciesImpl(api, profile, profile.gameId, dependentId,
          modName(collection), filtered, instPath, true);
      }

    });

    api.onAsync('cancel-dependency-install', (modId: string) => {
      this.mDependencyInstalls[modId]?.();
      return Promise.resolve();
    });
  }

  /**
   * add an installer extension
   *
   * @param {number} priority priority of the installer. the lower the number the higher
   *                          the priority, so at priority 0 the extension would always be
   *                          the first to be queried
   * @param {TestSupported} testSupported
   * @param {IInstall} install
   *
   * @memberOf InstallManager
   */
  public addInstaller(
    id: string,
    priority: number,
    testSupported: TestSupported,
    install: InstallFunc) {
    this.mInstallers.push({ id, priority, testSupported, install });
    this.mInstallers.sort((lhs: IModInstaller, rhs: IModInstaller): number => {
      return lhs.priority - rhs.priority;
    });
  }

  /**
   * start installing a mod.
   *
   * @param {string} archiveId id of the download. may be null if the download isn't
   *                           in our download archive
   * @param {string} archivePath path to the archive file
   * @param {string} downloadGameId gameId of the download as reported by the downloader
   * @param {IExtensionApi} extension api
   * @param {*} info existing information about the mod (i.e. stuff retrieved
   *                 from the download page)
   * @param {boolean} processDependencies if true, test if the installed mod is dependent
   *                                      of others and tries to install those too
   * @param {boolean} enable if true, enable the mod after installation
   * @param {Function} callback callback once this is finished
   * @param {boolean} forceGameId set if the user has already been queried which game
   *                              to install the mod for
   * @param {IFileListItem[]} fileList if set, the listed files (and only those) get extracted
   *                                   directly, ignoring any installer scripts
   * @param {boolean} unattended if set and there is an option preset, the installation
   *                             will happen automatically without user interaction
   * @param {boolean} forceInstaller if set, this should be the id of an installer
   *                                 (registerInstaller) to be used, instead of going through
   *                                 the auto-detection.
   */
  public install(
    archiveId: string,
    archivePath: string,
    downloadGameIds: string[],
    api: IExtensionApi,
    info: any,
    processDependencies: boolean,
    enable: boolean,
    callback: (error: Error, id: string) => void,
    forceGameId?: string,
    fileList?: IFileListItem[],
    unattended?: boolean,
    forceInstaller?: string,
    allowAutoDeploy?: boolean): void {

    if (this.mTask === undefined) {
      this.mTask = new Zip();
    }

    const fullInfo = { ...info };
    let rules: IRule[] = [];
    let overrides: string[] = [];
    let destinationPath: string;
    let tempPath: string;

    const dummyArchiveId = shortid();

    api.dismissNotification(`ready-to-install-${archiveId ?? dummyArchiveId}`);

    const baseName = path.basename(archivePath, path.extname(archivePath)).trim() || 'EMPTY_NAME';
    const currentProfile = activeProfile(api.store.getState());
    let modId = baseName;
    let installGameId: string;
    let installContext: InstallContext;
    let archiveMD5: string;
    let archiveSize: number;

    const oldCallback = callback;
    callback = (err: Error, id: string) => {
      oldCallback?.(err, id);
    };

    let existingMod: IMod;

    this.mQueue = this.mQueue
      .then(() => withContext('Installing', baseName, () => ((forceGameId !== undefined)
        ? Promise.resolve(forceGameId)
        : queryGameId(api.store, downloadGameIds, modId))
      .tap(gameId => {
        installGameId = gameId;
        if (installGameId === undefined) {
          return Promise.reject(
            new ProcessCanceled('You need to select a game before installing this mod'));
        }
        return api.emitAndAwait('will-install-mod', gameId, archiveId, modId, fullInfo);
      })
      // calculate the md5 hash here so we can store it with the mod meta information later,
      // otherwise we'd not remember the hash when installing from external file
      .tap(() => genHash(archivePath).then(hash => {
        archiveMD5 = hash.md5sum;
        archiveSize = hash.numBytes;
        _.merge(fullInfo, {
          download: {
            fileMD5: archiveMD5,
            size: archiveSize,
          },
        });
      }).catch(() => null))
      .then(gameId => {
        if (installGameId === 'site') {
          // install an already-downloaded extension
          return api.emitAndAwait('install-extension-from-download', archiveId)
            .then(() => Promise.reject(new UserCanceled()));
        }
        installContext = new InstallContext(gameId, api, allowAutoDeploy);
        installContext.startIndicator(baseName);
        let dlGame: string | string[] = getSafe(fullInfo, ['download', 'game'], gameId);
        if (Array.isArray(dlGame)) {
          dlGame = dlGame[0];
        }
        return api.lookupModMeta({
          filePath: archivePath,
          fileMD5: fullInfo.download.fileMD5,
          fileSize: fullInfo.download.size,
          gameId: dlGame as string,
        });
      })
      .then((modInfo: ILookupResult[]) => {
        log('debug', 'got mod meta information', { archivePath, resultCount: modInfo.length });
        const match = metaLookupMatch(modInfo, path.basename(archivePath), installGameId);
        if (match !== undefined) {
          fullInfo.meta = match.value;
        }

        modId = this.deriveInstallName(baseName, fullInfo);
        let testModId = modId;
        // if the name is already taken, consult the user,
        // repeat until user canceled, decided to replace the existing
        // mod or provided a new, unused name
        const checkNameLoop = () => this.checkModExists(testModId, api, installGameId)
          ? this.queryUserReplace(modId, installGameId, api)
            .then((choice: IReplaceChoice) => {
              testModId = choice.id;
              if (choice.enable) {
                enable = true;
              }
              setdefault(fullInfo, 'custom', {} as any).variant = choice.variant;
              rules = choice.rules || [];
              fullInfo.previous = choice.attributes;
              return checkNameLoop();
            })
          : Promise.resolve(testModId);
        return checkNameLoop();
      })
      // TODO: this is only necessary to get at the fileId and the fileId isn't
      //   even a particularly good way to discover conflicts
      .then(newModId => {
        modId = newModId;
        log('debug', 'mod id for newly installed mod', { archivePath, modId });
        return filterModInfo(fullInfo, undefined);
      })
      .then(modInfo => {
        const fileId = modInfo.fileId ?? modInfo.revisionId;
        const isCollection = modInfo.revisionId !== undefined;

        existingMod = (fileId !== undefined)
          ? this.findPreviousVersionMod(fileId, api.store, installGameId, isCollection)
          : undefined;

        const mods = api.getState().persistent.mods[installGameId] ?? {};
        const dependentRule: { [modId: string]: { owner: string, rule: IModRule } } =
            Object.keys(mods)
            .reduce((prev: { [modId: string]: { owner: string, rule: IModRule } }, iter) => {
              const depRule = (mods[iter].rules ?? [])
                .find(rule => (rule.type === 'requires')
                           && testModReference(existingMod, rule.reference));
              if (depRule !== undefined) {
                prev[iter] = { owner: iter, rule: depRule };
              }
              return prev;
            }, {});

        let broken: string[] = [];
        if (truthy(archiveId)) {
          const download = api.getState().persistent.downloads.files[archiveId];
          if (download !== undefined) {
            const lookup = lookupFromDownload(download);
            broken = Object.keys(dependentRule)
              .filter(iter => (!idOnlyRef(dependentRule[iter].rule.reference)
                && !testModReference(lookup, dependentRule[iter].rule.reference)));
          }
        }
        if (broken.length > 0) {
          return this.queryIgnoreDependent(
            api.store, installGameId, broken.map(id => dependentRule[id]));
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        if ((existingMod !== undefined) && (fullInfo.choices === undefined)) {
          fullInfo.choices = getSafe(existingMod, ['attributes', 'installerChoices'], undefined);
        }

        if ((existingMod !== undefined) && (currentProfile !== undefined)) {
          const wasEnabled = getSafe(currentProfile.modState, [existingMod.id, 'enabled'], false);
          return this.userVersionChoice(existingMod, api.store)
            .then((action: string) => {
              if (action === INSTALL_ACTION) {
                enable = enable || wasEnabled;
                if (wasEnabled) {
                  setModsEnabled(api, currentProfile.id, [existingMod.id], false, {
                    allowAutoDeploy,
                    installed: true,
                  });
                }
                rules = existingMod.rules || [];
                overrides = existingMod.fileOverrides;
                fullInfo.previous = existingMod.attributes;
                return Promise.resolve();
              } else if (action === REPLACE_ACTION) {
                rules = existingMod.rules || [];
                overrides = existingMod.fileOverrides;
                fullInfo.previous = existingMod.attributes;
                // we need to remove the old mod before continuing. This ensures
                // the mod is deactivated and undeployed (so we're not leave dangling
                // links) and it ensures we do a clean install of the mod
                return new Promise<void>((resolve, reject) => {
                  api.events.emit('remove-mod', currentProfile.gameId, existingMod.id,
                                  (error: Error) => {
                    if (error !== null) {
                      reject(error);
                    } else {
                      // use the same mod id as the old version so that all profiles
                      // keep using it.
                      modId = existingMod.id;
                      enable = enable || wasEnabled;
                      resolve();
                    }
                  }, { willBeReplaced: true });
                });
              }
            });
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        installContext.startInstallCB(modId, installGameId, archiveId);

        destinationPath = path.join(this.mGetInstallPath(installGameId), modId);
        log('debug', 'installing to', { modId, destinationPath });
        installContext.setInstallPathCB(modId, destinationPath);
        tempPath = destinationPath + '.installing';
        return this.installInner(api, archivePath,
                                 tempPath, destinationPath, installGameId, installContext,
                                 forceInstaller, fullInfo.choices, fileList, unattended);
      })
      .then(result => {
        const state: IState = api.store.getState();

        if (getSafe(state, ['persistent', 'mods', installGameId, modId, 'type'], '') === '') {
          return this.determineModType(installGameId, result.instructions)
              .then(type => {
                installContext.setModType(modId, type);
                return result;
              });
        } else {
          return Promise.resolve(result);
        }
      })
      .then(result => this.processInstructions(api, archivePath, tempPath, destinationPath,
                                               installGameId, modId, result,
                                               fullInfo.choices, unattended))
      .finally(() => {
        if (tempPath !== undefined) {
          log('debug', 'removing temporary path', tempPath);
          return fs.removeAsync(tempPath);
        } else {
          return Promise.resolve();
        }
      })
      .then(() => filterModInfo(fullInfo, destinationPath))
      .then(modInfo => {
        const state = api.getState();
        const existingKeys =
          Object.keys(state.persistent.mods[installGameId]?.[modId]?.attributes || {});
        installContext.finishInstallCB('success', _.omit(modInfo, existingKeys));
        (rules ?? []).forEach(rule => {
          api.store.dispatch(addModRule(installGameId, modId, rule));
        });
        api.store.dispatch(setFileOverride(installGameId, modId, overrides));
        if (currentProfile !== undefined) {
          if (enable) {
            setModsEnabled(api, currentProfile.id, [modId], true, {
              allowAutoDeploy,
              installed: true,
            });
          }
          /*
          if (processDependencies) {
            log('info', 'process dependencies', { modId });
            const mod: IMod = state.persistent.mods[installGameId]?.[modId];

            this.installDependenciesImpl(api, currentProfile,
                                         mod.id, modName(mod),
                                         [].concat(modInfo.rules || [], mod.rules || []),
                                         this.mGetInstallPath(installGameId))
              .then(() => this.installRecommendationsImpl(
                                         api, currentProfile,
                                         mod.id, modName(mod),
                                         [].concat(modInfo.rules || [], mod.rules || []),
                                         this.mGetInstallPath(installGameId)));
          }
          */
        }
        this.setModSize(api, modId, installGameId);
        callback?.(null, modId);
        api.events.emit('did-install-mod', installGameId, archiveId, modId, modInfo);
        return null;
      })
      .catch(err => {
        // TODO: make this nicer. especially: The first check doesn't recognize UserCanceled
        //   exceptions from extensions, hence we have to do the string check (last one)
        const canceled = (err instanceof UserCanceled)
                         || (err instanceof TemporaryError)
                         || (err instanceof ProcessCanceled)
                         || !truthy(err)
                         || (err.message === 'Canceled')
                         || (truthy(err.stack)
                             && err.stack.startsWith('UserCanceled: canceled by user'));
        let prom = destinationPath !== undefined
          ? fs.removeAsync(destinationPath)
            .catch(UserCanceled, () => null)
            .catch(innerErr => {
              installContext.reportError(
                'Failed to clean up installation directory "{{destinationPath}}", '
                + 'please close Vortex and remove it manually.',
                innerErr, innerErr.code !== 'ENOTEMPTY', { destinationPath });
            })
          : Promise.resolve();

        if (installContext !== undefined) {
          const pretty = prettifyNodeErrorMessage(err);
          // context doesn't have to be set if we canceled early
          prom = prom.then(() => installContext.finishInstallCB(
            canceled ? 'canceled' : 'failed',
            undefined,
            api.translate(pretty.message, { replace: pretty.replace })));
        }

        if (err === undefined) {
          return prom.then(() => {
            callback?.(new Error('unknown error'), null);
          });
        } else if (canceled) {
          return prom.then(() => {
            callback?.(err, null);
          });
        } else if (err instanceof ArchiveBrokenError) {
          return prom
            .then(() => {
              if (installContext !== undefined) {
                api.sendNotification({
                  type: 'info',
                  title: 'Installation failed, archive is damaged',
                  message: path.basename(archivePath),
                  actions: [
                    { title: 'Delete', action: dismiss => {
                      api.events.emit('remove-download', archiveId, dismiss); } },
                    { title: 'Delete & Redownload', action: dismiss => {
                      const state: IState = api.store.getState();
                      const download = state.persistent.downloads.files[archiveId];
                      api.events.emit('remove-download', archiveId, () => {
                        dismiss();
                        api.events.emit('start-download', download.urls, info.download,
                          path.basename(archivePath));
                      });
                      dismiss();
                    } },
                  ],
                });
              }
              callback?.(err, null);
            });
        } else if (err instanceof SetupError) {
          return prom
            .then(() => {
              if (installContext !== undefined) {
                installContext.reportError(
                  'Installation failed',
                  err,
                  false, {
                    installerPath: path.basename(archivePath),
                    message: err.message,
                  });
              }
              callback?.(err, null);
            });
        } else if (err instanceof DataInvalid) {
          return prom
            .then(() => {
              if (installContext !== undefined) {
                installContext.reportError(
                  'Installation failed',
                  'The installer {{ installerPath }} is invalid and couldn\'t be '
                  + 'installed:\n{{ message }}\nPlease inform the mod author.\n',
                  false, {
                    installerPath: path.basename(archivePath),
                    message: err.message,
                  });
              }
              callback?.(err, null);
            });
        } else if (err['code'] === 'MODULE_NOT_FOUND') {
          const location = err['requireStack'] !== undefined
            ? ` (at ${err['requireStack'][0]})`
            : '';
          installContext.reportError('Installation failed',
            'Module failed to load:\n{{message}}{{location}}\n\n'
            + 'This usually indicates that the Vortex installation has been '
            + 'corrupted or an external application (like an Anti-Virus) has interfered with '
            + 'the loading of the module. '
            + 'Please check whether your AV reported something and try reinstalling Vortex.',
            false, {
              location,
              message: err.message.split('\n')[0],
            });
          callback?.(err, null);
        } else {
          return prom
            .then(() => genHash(archivePath).catch(() => ({})))
            .then((hashResult: IHashResult) => {
              const id = `${path.basename(archivePath)} (md5: ${hashResult.md5sum})`;
              let replace = {};
              if (typeof err === 'string') {
                err = 'The installer "{{ id }}" failed: {{ message }}';
                replace = {
                      id,
                      message: err,
                    };
              }
              if (installContext !== undefined) {
                const browserAssistantMsg = 'The installer has failed due to an external 3rd '
                  + 'party application you have installed on your system named '
                  + '"Browser Assistant". This application inserts itself globally '
                  + 'and breaks any other application that uses the same libraries as it does.\n\n'
                  + 'To use Vortex, please uninstall "Browser Assistant".';
                const errorMessage = (typeof err === 'string') ? err : err.message;
                let allowReport: boolean;
                if (err.message.includes('No compatible .Net Framework')) {
                  allowReport = false;
                }
                (!this.isBrowserAssistantError(errorMessage))
                  ? installContext.reportError('Installation failed', err, allowReport, replace)
                  : installContext.reportError('Installation failed', browserAssistantMsg, false);
              }
              callback?.(err, modId);
            });
        }
      })
      .finally(() => {
        if (installContext !== undefined) {
          const state = api.store.getState();
          const mod: IMod = getSafe(state, ['persistent', 'mods', installGameId, modId], undefined);
          installContext.stopIndicator(mod);
        }
      })));
  }

  public installDependencies(api: IExtensionApi, profile: IProfile, gameId: string, modId: string,
                             allowAutoDeploy: boolean): Promise<void> {
    const state: IState = api.store.getState();
    const mod: IMod = state.persistent.mods[gameId]?.[modId];

    if (mod === undefined) {
      return Promise.reject(new ProcessCanceled(`Invalid mod specified "${modId}"`));
    }

    this.repairRules(api, mod, gameId);

    const installPath = this.mGetInstallPath(gameId);
    log('info', 'start installing dependencies');
    api.store.dispatch(startActivity('installing_dependencies', mod.id));
    return this.installDependenciesImpl(api, profile, gameId, mod.id, modName(mod), mod.rules,
                                        installPath, allowAutoDeploy)
      .finally(() => {
        log('info', 'done installing dependencies');
        api.store.dispatch(stopActivity('installing_dependencies', mod.id));
      });
  }

  public installRecommendations(api: IExtensionApi,
                                profile: IProfile,
                                gameId: string,
                                modId: string)
                                : Promise<void> {
    const state: IState = api.store.getState();
    const mod: IMod = getSafe(state, ['persistent', 'mods', gameId, modId], undefined);

    if (mod === undefined) {
      return Promise.reject(new ProcessCanceled(`Invalid mod specified "${modId}"`));
    }

    this.repairRules(api, mod, gameId);

    const installPath = this.mGetInstallPath(gameId);
    log('info', 'start installing recommendations');
    api.store.dispatch(startActivity('installing_dependencies', mod.id));
    return this.installRecommendationsImpl(api, profile, gameId, mod.id, modName(mod),
                                           mod.rules, installPath, false)
      .finally(() => {
        log('info', 'done installing recommendations');
        api.store.dispatch(stopActivity('installing_dependencies', mod.id));
      });
  }

  private hasFuzzyReference(ref: IModReference): boolean {
    return (ref.fileExpression !== undefined)
        || (ref.fileMD5 !== undefined)
        || (ref.logicalFileName !== undefined);
  }

  private setModSize(api: IExtensionApi, modId: string, gameId: string): Promise<void> {
    const state = api.getState();
    const stagingFolder = installPathForGame(state, gameId);
    const mod = state.persistent.mods[gameId]?.[modId];
    if (mod?.installationPath === undefined) {
      log('debug', 'failed to calculate modSize', 'mod is not in state');
      return Promise.resolve();
    }
    const modPath = path.join(stagingFolder, mod.installationPath);
    return calculateFolderSize(modPath)
    .then((totalSize) => {
      api.store.dispatch(setModAttribute(gameId, mod.id, 'modSize', totalSize));
      return Promise.resolve();
    })
    .catch(err => {
      log('debug', 'failed to calculate modSize', err);
      return Promise.resolve();
    });
  }

  /**
   * when installing a mod from a dependency rule we store the id of the installed mod
   * in the rule for quicker and consistent matching but if - at a later time - we
   * install those same dependencies again we have to unset those ids, otherwise the
   * dependence installs would fail.
   */
  private repairRules(api: IExtensionApi, mod: IMod, gameId: string) {
    const state: IState = api.store.getState();
    const mods = state.persistent.mods[gameId];

    (mod.rules || []).forEach(rule => {
      if ((rule.reference.id !== undefined)
          && (mods[rule.reference.id] === undefined)
          && this.hasFuzzyReference(rule.reference)) {
        const newRule: IModRule = JSON.parse(JSON.stringify(rule));
        api.store.dispatch(removeModRule(gameId, mod.id, rule));
        delete newRule.reference.id;
        api.store.dispatch(addModRule(gameId, mod.id, newRule));
      }
    });
  }

  private isBrowserAssistantError(error: string): boolean {
    return (process.platform === 'win32')
        && (error.indexOf('Roaming\\Browser Assistant') !== -1);
  }

  private isCritical(error: string): boolean {
    return (error.indexOf('Unexpected end of archive') !== -1)
        || (error.indexOf('ERROR: Data Error') !== -1)
        || (error.indexOf('Can not open the file as archive') !== -1);
  }

  /**
   * find the right installer for the specified archive, then install
   */
  private installInner(api: IExtensionApi, archivePath: string,
                       tempPath: string, destinationPath: string,
                       gameId: string, installContext: IInstallContext,
                       forceInstaller?: string,
                       installChoices?: any,
                       extractList?: IFileListItem[],
                       unattended?: boolean): Promise<IInstallResult> {
    const fileList: string[] = [];
    let phase = 'Extracting';

    const progress = (files: string[], percent: number) => {
      if ((percent !== undefined) && (installContext !== undefined)) {
        installContext.setProgress(phase, percent);
      }
    };
    log('debug', 'extracting mod archive', { archivePath, tempPath });
    let extractProm: Promise<any>;
    if (FILETYPES_AVOID.includes(path.extname(archivePath).toLowerCase())) {
      extractProm = Promise.reject(new ArchiveBrokenError('file type on avoidlist'));
    } else {
      extractProm = this.mTask.extractFull(archivePath, tempPath, {ssc: false},
                                    progress,
                                    () => this.queryPassword(api.store) as any)
          .catch((err: Error) => this.isCritical(err.message)
            ? Promise.reject(new ArchiveBrokenError(err.message))
            : Promise.reject(err));
    }

    return extractProm
        .then(({ code, errors }: {code: number, errors: string[] }) => {
          log('debug', 'extraction completed');
          phase = 'Installing';
          if (installContext !== undefined) {
            installContext.setProgress('Installing');
          }
          if (code !== 0) {
            log('warn', 'extraction reported error', { code, errors: errors.join('; ') });
            const critical = errors.find(this.isCritical);
            if (critical !== undefined) {
              return Promise.reject(new ArchiveBrokenError(critical));
            }
            return this.queryContinue(api, errors, archivePath);
          } else {
            return Promise.resolve();
          }
        })
        .catch(ArchiveBrokenError, err => {
          if (archiveExtLookup.has(path.extname(archivePath).toLowerCase())) {
            // hmm, it was supposed to support the file type though...
            return Promise.reject(err);
          }

          if ([STAGING_DIR_TAG, DOWNLOADS_DIR_TAG].indexOf(path.basename(archivePath)) !== -1) {
            // User just tried to install the staging/downloads folder tag file as a mod...
            //  this actually happens too often. https://github.com/Nexus-Mods/Vortex/issues/6727
            return api.showDialog('question', 'Not a mod', {
              text: 'You are attempting to install one of Vortex\'s directory tags as a mod. '
                + 'This file is generated and used by Vortex internally and should not be installed '
                + 'in this way.',
              message: archivePath,
            }, [
                { label: 'Ok' },
              ]).then(() => Promise.reject(new ProcessCanceled('Not a mod')));
          }

          // this is really a completely separate process from the "regular" mod installation
          return api.showDialog('question', 'Not an archive', {
            text: 'Vortex is designed to install mods from archives but this doesn\'t look '
              + 'like one. Do you want to create a mod containing just this file?',
            message: archivePath,
          }, [
              { label: 'Cancel' },
              { label: 'Create Mod' },
            ]).then(result => {
              if (result.action === 'Cancel') {
                return Promise.reject(new UserCanceled());
              }

              return fs.ensureDirAsync(tempPath)
                .then(() => fs.copyAsync(archivePath,
                  path.join(tempPath, path.basename(archivePath))));
            });
        })
        .then(() => walk(tempPath,
                         (iterPath, stats) => {
                           if (stats.isFile()) {
                             fileList.push(path.relative(tempPath, iterPath));
                           } else {
                             // unfortunately we also have to pass directories because
                             // some mods contain empty directories to control stop-folder
                             // management...
                             fileList.push(path.relative(tempPath, iterPath) + path.sep);
                           }
                           return Promise.resolve();
                         }))
        .finally(() => {
          // process.noAsar = false;
        })
        .then(() => {
          if (truthy(extractList) && extractList.length > 0) {
            return makeListInstaller(extractList, tempPath);
          } else if (forceInstaller === undefined) {
            return this.getInstaller(fileList, gameId);
          } else {
            const forced = this.mInstallers.find(inst => inst.id === forceInstaller);
            return forced.testSupported(fileList, gameId)
              .then((testResult: ISupportedResult) => {
                if (!testResult.supported) {
                  return undefined;
                } else {
                  return {
                    installer: forced,
                    requiredFiles: testResult.requiredFiles,
                  };
                }
              });
          }
        })
        .then(supportedInstaller => {
          if (supportedInstaller === undefined) {
            throw new Error('no installer supporting this file');
          }

          const {installer, requiredFiles} = supportedInstaller;
          log('debug', 'invoking installer',
            { installer: installer.id, enforced: forceInstaller !== undefined });
          return installer.install(
              fileList, tempPath, gameId,
              (perc: number) => {
                log('info', 'progress', perc);
                progress([], perc);
              },
              installChoices,
              unattended);
        });
  }

  private determineModType(gameId: string, installInstructions: IInstruction[]): Promise<string> {
    log('info', 'determine mod type', { gameId });
    const game = getGame(gameId);
    if (game === undefined) {
      return Promise.reject(new Error(`Invalid game "${gameId}"`));
    }
    const modTypes: IModType[] = game.modTypes;
    const sorted = modTypes.sort((lhs, rhs) => lhs.priority - rhs.priority);
    let found = false;

    return Promise.mapSeries(sorted, (type: IModType): Promise<string> => {
      if (found) {
        return Promise.resolve<string>(null);
      }

      return type.test(installInstructions)
      .then(matches => {
        if (matches) {
          found = true;
          return Promise.resolve(type.typeId);
        } else {
          return Promise.resolve(null);
        }
      });
    }).then(matches => matches.find(match => match !== null) || '');
  }

  private queryContinue(api: IExtensionApi,
                        errors: string[],
                        archivePath: string): Promise<void> {
    const terminal = errors.find(err => err.indexOf('Can not open the file as archive') !== -1);

    return new Promise<void>((resolve, reject) => {
      const actions = [
        { label: 'Cancel', action: () => reject(new UserCanceled()) },
        { label: 'Delete', action: () => {
          const state: IState = api.store.getState();
          fs.removeAsync(archivePath)
            .catch(err => api.showErrorNotification('Failed to remove archive', err,
                                                    { allowReport: false }))
            .finally(() => {
              const { files } = api.getState().persistent.downloads;
              const dlId = Object.keys(files)
                .find(iter => files[iter].localPath === path.basename(archivePath));
              if (dlId !== undefined) {
                api.store.dispatch(removeDownload(dlId));
              }
              reject(new UserCanceled());
            });
        } },
      ];

      if (!terminal) {
        actions.push({ label: 'Continue', action: () => resolve() });
      }

      const title = api.translate('Archive damaged "{{archiveName}}"',
                                  { replace: { archiveName: path.basename(archivePath) } });
      api.store.dispatch(showDialog('error', title, {
        bbcode: api.translate('Encountered errors extracting this archive. Please verify this '
          + 'file was downloaded correctly.\n[list]{{ errors }}[/list]', {
          replace: { errors: errors.map(err => '[*] ' + err) },
        }),
        options: { translated: true },
      }, actions));
    });
  }

  private queryPassword(store: ThunkStore<any>): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      store
          .dispatch(showDialog(
              'info', 'Password Protected',
              {
                input: [{
                  id: 'password',
                  type: 'password',
                  value: '',
                  label: 'A password is required to extract this archive',
                }],
              }, [ { label: 'Cancel' }, { label: 'Continue' } ]))
          .then((result: IDialogResult) => {
            if (result.action === 'Continue') {
              resolve(result.input['password']);
            } else {
              reject(new UserCanceled());
            }
          });
    });
  }

  private validateInstructions(instructions: IInstruction[]): IInvalidInstruction[] {
    const sanitizeSep = new RegExp('/', 'g');
    // Validate the ungrouped instructions and return errors (if any)
    const invalidDestinationErrors: IInvalidInstruction[] = instructions.filter(instr => {
      if (!!instr.destination) {
        // This is a temporary hack to avoid invalidating fomod instructions
        //  which will include a path separator at the beginning of a relative path
        //  when matching nested stop patterns.
        const destination = (instr.destination.charAt(0) === path.sep)
          ? instr.destination.substr(1)
          : instr.destination;

        // Ensure we use windows path separators as scripted installers
        //  will sometime return *nix separators.
        const sanitized = (process.platform === 'win32')
          ? destination.replace(sanitizeSep, path.sep)
          : destination;
        return (!isPathValid(sanitized, true));
      }

      return false;
    }).map(instr => {
        return {
          type: instr.type,
          error: `invalid destination path: "${instr.destination}"`,
        };
      });

    return [].concat(invalidDestinationErrors);
  }

  private transformInstructions(input: IInstruction[]): InstructionGroups {
    return input.reduce((prev, value) => {
      if (truthy(value) && (prev[value.type] !== undefined)) {
        prev[value.type].push(value);
      }
      return prev;
    }, new InstructionGroups());
  }

  private reportUnsupported(api: IExtensionApi, unsupported: IInstruction[], archivePath: string) {
    if (unsupported.length === 0) {
      return;
    }
    const missing = unsupported.map(instruction => instruction.source);
    const makeReport = () =>
        genHash(archivePath)
            .catch(err => ({}))
            .then(
                (hashResult: IHashResult) => createErrorReport(
                    'Installer failed',
                    {
                      message: 'The installer uses unimplemented functions',
                      details:
                          `Missing instructions: ${missing.join(', ')}\n` +
                              `Installer name: ${path.basename(archivePath)}\n` +
                              `MD5 checksum: ${hashResult.md5sum}\n`,
                    }, {},
                    ['installer'], api.store.getState()));
    const showUnsupportedDialog = () => api.store.dispatch(showDialog(
        'info', 'Installer unsupported',
        {
          message:
              'This installer is (partially) unsupported as it\'s ' +
              'using functionality that hasn\'t been implemented yet. ' +
              'Please help us fix this by submitting an error report with a link to this mod.',
        }, (isOutdated() || didIgnoreError()) ? [
          { label: 'Close' },
        ] : [
          { label: 'Report', action: makeReport },
          { label: 'Close' },
        ]));

    api.sendNotification({
      type: 'info',
      message: 'Installer unsupported',
      actions: [{title: 'More', action: showUnsupportedDialog}],
    });
  }

  private processMKDir(instructions: IInstruction[],
                       destinationPath: string): Promise<void> {
    return Promise.each(instructions,
                        instruction => fs.ensureDirAsync(path.join(
                            destinationPath, instruction.destination)))
        .then(() => undefined);
  }

  private processGenerateFiles(generatefile: IInstruction[],
                               destinationPath: string): Promise<void> {
    return Promise.each(generatefile, gen => {
      const outputPath = path.join(destinationPath, gen.destination);
      return fs.ensureDirAsync(path.dirname(outputPath))
        // data buffers are sent to us base64 encoded
        .then(() => fs.writeFileAsync(outputPath, gen.data));
    }).then(() => undefined);
  }

  private processSubmodule(api: IExtensionApi, submodule: IInstruction[],
                           destinationPath: string,
                           gameId: string, modId: string,
                           choices: any, unattended: boolean): Promise<void> {
    return Promise.each(submodule,
      mod => {
        const tempPath = destinationPath + '.' + shortid() + '.installing';
        log('debug', 'install submodule', { modPath: mod.path, tempPath, destinationPath });
        const subContext = new InstallContext(gameId, api, unattended);
        subContext.startIndicator(api.translate('nested: {{modName}}',
          { replace: { modName: path.basename(mod.path) } }));
        return this.installInner(api, mod.path, tempPath, destinationPath,
                                 gameId, subContext, undefined,
                                 choices, undefined, unattended)
          .then((resultInner) => this.processInstructions(
            api, mod.path, tempPath, destinationPath,
            gameId, modId, resultInner, choices, unattended))
          .then(() => {
            if (mod.submoduleType !== undefined) {
              api.store.dispatch(setModType(gameId, modId, mod.submoduleType));
            }
          })
          .finally(() => {
            subContext.finishInstallCB('ignore');
            subContext.stopIndicator();
            log('debug', 'removing submodule', tempPath);
            fs.removeAsync(tempPath);
          });
      })
        .then(() => undefined);
  }

  private processAttribute(api: IExtensionApi, attribute: IInstruction[],
                           gameId: string, modId: string): Promise<void> {
    attribute.forEach(attr => {
      api.store.dispatch(setModAttribute(gameId, modId, attr.key, attr.value));
    });
    return Promise.resolve();
  }

  private processEnableAllPlugins(api: IExtensionApi, enableAll: IInstruction[],
                                  gameId: string, modId: string): Promise<void> {
    if (enableAll.length > 0) {
      api.store.dispatch(setModAttribute(gameId, modId, 'enableallplugins', true));
    }
    return Promise.resolve();
  }

  private processSetModType(api: IExtensionApi, types: IInstruction[],
                            gameId: string, modId: string): Promise<void> {
    if (types.length > 0) {
      api.store.dispatch(setModType(gameId, modId, types[types.length - 1].value));
      if (types.length > 1) {
        log('error', 'got more than one mod type, only the last was used', { types });
      }
    }
    return Promise.resolve();
  }

  private processRule(api: IExtensionApi, rules: IInstruction[],
                      gameId: string, modId: string): Promise<void> {
    rules.forEach(rule => {
      api.store.dispatch(addModRule(gameId, modId, rule.rule));
    });
    return Promise.resolve();
  }

  private processIniEdits(api: IExtensionApi,
                          iniEdits: IInstruction[],
                          destinationPath: string,
                          gameId: string, modId: string): Promise<void> {
    if (iniEdits.length === 0) {
      return Promise.resolve();
    }

    const byDest: { [dest: string]: IInstruction[] } = iniEdits.reduce(
      (prev: { [dest: string]: IInstruction[] }, value) => {
      setdefault(prev, value.destination, []).push(value);
      return prev;
    }, {});

    return fs.ensureDirAsync(path.join(destinationPath, INI_TWEAKS_PATH))
      .then(() => Promise.map(Object.keys(byDest), destination => {
      const bySection: {[section: string]: IInstruction[]} =
          byDest[destination].reduce((prev: { [section: string]: IInstruction[] }, value) => {
            setdefault(prev, value.section, []).push(value);
            return prev;
          }, {});

      const renderKV = (instruction: IInstruction): string =>
          `${instruction.key} = ${instruction.value}`;

      const renderSection = (section: string) => [
        `[${section}]`,
      ].concat(bySection[section].map(renderKV)).join(os.EOL);

      const content = Object.keys(bySection).map(renderSection).join(os.EOL);

      const basename = path.basename(destination, path.extname(destination));
      const tweakId = `From Installer [${basename}].ini`;
      api.store.dispatch(setINITweakEnabled(gameId, modId, tweakId, true));

      return fs.writeFileAsync(
        path.join(destinationPath, INI_TWEAKS_PATH, tweakId),
        content);
    }))
    .then(() => undefined);
  }

  private processInstructions(api: IExtensionApi, archivePath: string,
                              tempPath: string, destinationPath: string,
                              gameId: string, modId: string,
                              result: { instructions: IInstruction[] },
                              choices: any, unattended: boolean) {
    if (result.instructions === null) {
      // this is the signal that the installer has already reported what went
      // wrong. Not necessarily a "user canceled" but the error handling happened
      // in the installer so we don't know what happened.
      return Promise.reject(new UserCanceled());
    }

    if ((result.instructions === undefined) ||
        (result.instructions.length === 0)) {
      return Promise.reject(new ProcessCanceled('Empty archive or no options selected'));
    }

    const invalidInstructions = this.validateInstructions(result.instructions);
    if (invalidInstructions.length > 0) {
      const game = getGame(gameId);
      // we can also get here with invalid instructions from scripted installers
      // so even if the game is not contributed, this is still probably not a bug
      // const allowReport = (game.contributed === undefined);
      const allowReport = false;
      const error = (allowReport)
        ? 'Invalid installer instructions found for "{{ modId }}".'
        : 'Invalid installer instructions found for "{{ modId }}". Please inform '
          + 'the game extension\'s developer - "{{ contributor }}", or the mod author.';
      api.showErrorNotification('Invalid mod installer instructions', {
        invalid: '\n' + invalidInstructions.map(inval =>
          `(${inval.type}) - ${inval.error}`).join('\n'),
        message: error,
      }, {
        replace: {
          modId,
          contributor: game.contributed,
        },
        allowReport,
      });
      return Promise.reject(new ProcessCanceled('Invalid installer instructions'));
    }

    const instructionGroups = this.transformInstructions(result.instructions);

    if (instructionGroups.error.length > 0) {
      const fatal = instructionGroups.error.find(err => err.value === 'fatal');
      let error = 'Errors were reported processing the installer for "{{ modId }}". ';

      if (fatal === undefined) {
        error += 'It\'s possible the mod works (partially) anyway. '
        + 'Please note that NMM tends to ignore errors so just because NMM doesn\'t '
        + 'report a problem with this installer doesn\'t mean it doesn\'t have any.';
      }

      api.showErrorNotification('Installer reported errors',
        error + '\n{{ errors }}', {
          replace: {
            errors: instructionGroups.error.map(err => err.source).join('\n'),
            modId,
          },
          allowReport: false,
          message: modId,
        });
      if (fatal !== undefined) {
        return Promise.reject(new ProcessCanceled('Installer script failed'));
      }
    }

    log('debug', 'installer instructions',
        JSON.stringify(result.instructions.map(instr => _.omit(instr, ['data']))));
    this.reportUnsupported(api, instructionGroups.unsupported, archivePath);

    return this.processMKDir(instructionGroups.mkdir, destinationPath)
      .then(() => this.extractArchive(api, archivePath, tempPath, destinationPath,
                                      instructionGroups.copy, gameId))
      .then(() => this.processGenerateFiles(instructionGroups.generatefile,
                                            destinationPath))
      .then(() => this.processIniEdits(api, instructionGroups.iniedit, destinationPath,
                                       gameId, modId))
      .then(() => this.processSubmodule(api, instructionGroups.submodule,
                                        destinationPath, gameId, modId,
                                        choices, unattended))
      .then(() => this.processAttribute(api, instructionGroups.attribute, gameId, modId))
      .then(() => this.processEnableAllPlugins(api, instructionGroups.enableallplugins,
                                               gameId, modId))
      .then(() => this.processSetModType(api, instructionGroups.setmodtype, gameId, modId))
      .then(() => this.processRule(api, instructionGroups.rule, gameId, modId))
      ;
  }

  private checkModExists(installName: string, api: IExtensionApi, gameMode: string): boolean {
    return installName in (api.store.getState().persistent.mods[gameMode] || {});
  }

  private findPreviousVersionMod(fileId: number, store: Redux.Store<any>,
                                 gameMode: string, isCollection: boolean): IMod {
    const mods = store.getState().persistent.mods[gameMode] || {};
    // This is not great, but we need to differentiate between revisionIds and fileIds
    //  as it's perfectly possible for a collection's revision id to match a regular
    //  mod's fileId resulting in false positives and therefore mashed up metadata.
    const filterFunc = (modId: string) => (isCollection)
      ? mods[modId].type === 'collection'
      : mods[modId].type !== 'collection';
    let mod: IMod;
    Object.keys(mods).filter(filterFunc).forEach(key => {
      // TODO: fileId/revisionId can potentially be more up to date than the last
      //  known "newestFileId" property if the curator/mod author has released a new
      //  version of his collection/mod since the last time the user checked for updates
      const newestFileId: number = mods[key].attributes?.newestFileId;
      const currentFileId: number =
        mods[key].attributes?.fileId ?? mods[key].attributes?.revisionId;
      if ((newestFileId !== currentFileId)
          && (newestFileId === fileId)) {
        mod = mods[key];
      }
    });

    return mod;
  }

  private queryIgnoreDependent(store: ThunkStore<any>, gameId: string,
                               dependents: Array<{ owner: string, rule: IModRule }>)
                               : Promise<void> {
    return new Promise<void>((resolve, reject) => {
      store.dispatch(showDialog(
          'question', 'Updating may break dependencies',
          {
            text:
            'You\'re updating a mod that others depend upon and the update doesn\'t seem to '
            + 'be compatible (according to the dependency information). '
            + 'If you continue we have to disable these dependencies, otherwise you\'ll '
            + 'continually get warnings about it.',
            options: { wrap: true },
          },
          [
            { label: 'Cancel' },
            { label: 'Ignore' },
          ]))
        .then((result: IDialogResult) => {
          if (result.action === 'Cancel') {
            reject(new UserCanceled());
          } else {
            const ruleActions = dependents.reduce((prev, dep) => {
              prev.push(removeModRule(gameId, dep.owner, dep.rule));
              prev.push(addModRule(gameId, dep.owner, {
                ...dep.rule,
                ignored: true,
              }));
              return prev;
            }, []);
            batchDispatch(store, ruleActions);
            resolve();
          }
        });
    });
  }

  private userVersionChoice(oldMod: IMod, store: ThunkStore<any>): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      store.dispatch(showDialog(
          'question', modName(oldMod),
          {
            text:
            'An older version of this mod is already installed. '
            + 'You can replace the existing one - which will update all profiles - '
            + 'or install this one alongside it. In the latter case both versions '
            + 'will be available and only the active profile will be updated. ',
            options: { wrap: true },
          },
          [
            { label: 'Cancel' },
            { label: REPLACE_ACTION },
            { label: INSTALL_ACTION },
          ]))
        .then((result: IDialogResult) => {
          if (result.action === 'Cancel') {
            reject(new UserCanceled());
          } else {
            resolve(result.action);
          }
        });
    });
  }

  private queryUserReplace(modId: string, gameId: string, api: IExtensionApi) {
    return new Promise<IReplaceChoice>((resolve, reject) => {
      const state: IState = api.store.getState();
      const mod: IMod = state.persistent.mods[gameId][modId];
      if (mod === undefined) {
        // Technically for this to happen the timing must be *perfect*,
        //  the replace query dialog will only show if we manage to confirm that
        //  the modId is indeed stored persistently - but if somehow the user
        //  was able to finish removing the mod right as the replace dialog
        //  appears the mod could be potentially missing from the state.
        // In this case we resolve using the existing modId.
        // https://github.com/Nexus-Mods/Vortex/issues/7972
        const currentProfile = activeProfile(api.store.getState());
        return resolve({
          id: modId,
          variant: '',
          enable: getSafe(currentProfile, ['modState', modId, 'enabled'], false),
          attributes: {},
          rules: [],
        });
      }
      api.store
        .dispatch(showDialog(
          'question', modName(mod, { version: false }),
          {
            text:
              'This mod seems to be installed already. '
              + 'You can replace the existing one - which will update all profiles - '
              + 'or install the new one under a different name. '
              + 'If you do the latter, the new installation will appear as a variant '
              + 'of the other mod that can be toggled through the version dropdown. '
              + 'Use the input below to make the variant distinguishable.',
            input: [{
              id: 'variant',
              value: '2',
              label: 'Variant',
            }],
            options: {
              wrap: true,
            },
          },
          [
            { label: 'Cancel' },
            { label: VARIANT_ACTION },
            { label: REPLACE_ACTION },
          ]))
        .then((result: IDialogResult) => {
          const currentProfile = activeProfile(api.store.getState());
          const wasEnabled = () => {
            return (currentProfile?.gameId === gameId)
              ? getSafe(currentProfile.modState, [modId, 'enabled'], false)
              : false;
          };

          if (result.action === 'Cancel') {
            reject(new UserCanceled());
          } else if (result.action === VARIANT_ACTION) {
            if (currentProfile !== undefined) {
              api.store.dispatch(setModEnabled(currentProfile.id, modId, false));
            }
            resolve({
              id: modId + '+' + result.input.variant,
              variant: result.input.variant,
              enable: wasEnabled(),
              attributes: {},
              rules: [],
            });
          } else if (result.action === REPLACE_ACTION) {
            api.events.emit('remove-mod', gameId, modId, (err) => {
              if (err !== null) {
                reject(err);
              } else {
                resolve({
                  id: modId,
                  variant: '',
                  enable: wasEnabled(),
                  attributes: _.omit(mod.attributes, ['version', 'fileName', 'fileVersion']),
                  rules: mod.rules,
                });
              }
            }, { willBeReplaced: true });
          }
        });
    });
  }

  private getInstaller(
    fileList: string[],
    gameId: string,
    offsetIn?: number): Promise<ISupportedInstaller> {
    const offset = offsetIn || 0;
    if (offset >= this.mInstallers.length) {
      return Promise.resolve(undefined);
    }
    return Promise.resolve(this.mInstallers[offset].testSupported(fileList, gameId))
      .then((testResult: ISupportedResult) => {
          if (testResult === undefined) {
            log('error', 'Buggy installer', this.mInstallers[offset].id);
          }
          return (testResult?.supported === true)
            ? Promise.resolve({
              installer: this.mInstallers[offset],
              requiredFiles: testResult.requiredFiles,
            })
            : this.getInstaller(fileList, gameId, offset + 1);
      });
  }

  /**
   * determine the mod name (on disk) from the archive path
   * TODO: this currently simply uses the archive name which should be fine
   *   for downloads from nexus but in general we need the path to encode the
   *   mod, the specific "component" and the version. And then we need to avoid
   *   collisions.
   *   Finally, the way I know users they will want to customize this.
   *
   * @param {string} archiveName
   * @param {*} info
   * @returns
   */
  private deriveInstallName(archiveName: string, info: any) {
    return deriveModInstallName(archiveName, info);
  }

  private downloadURL(api: IExtensionApi,
                      lookupResult: IModInfoEx,
                      wasCanceled: () => boolean,
                      referenceTag?: string,
                      campaign?: string,
                      fileName?: string): Promise<string> {
    const call = (input: string | (() => Promise<string>)): Promise<string> =>
      (input !== undefined) && (typeof(input) === 'function')
      ? input() : Promise.resolve(input as string);

    let resolvedSource: string;
    let resolvedReferer: string;

    return call(lookupResult.sourceURI).then(res => resolvedSource = res)
      .then(() => call(lookupResult.referer).then(res => resolvedReferer = res))
      .then(() => new Promise<string>((resolve, reject) => {
        if (wasCanceled()) {
          return reject(new UserCanceled(false));
        } else if (!truthy(resolvedSource)) {
          return reject(new UserCanceled(true));
        }
        const parsedUrl = new URL(resolvedSource);
        if ((campaign !== undefined) && (parsedUrl.protocol === 'nxm:')) {
          parsedUrl.searchParams.set('campaign', campaign);
        }

        if (!api.events.emit('start-download', [url.format(parsedUrl)], {
          game: convertGameIdReverse(knownGames(api.store.getState()), lookupResult.domainName),
          source: lookupResult.source,
          name: lookupResult.logicalFileName,
          referer: resolvedReferer,
          referenceTag,
          meta: lookupResult,
        }, fileName,
          (error, id) => {
            if (error === null) {
              resolve(id);
            } else if (error instanceof AlreadyDownloaded) {
              resolve(error.downloadId);
            } else {
              reject(error);
            }
          }, 'never', { allowInstall: false, allowOpenHTML: false })) {
          reject(new Error('download manager not installed?'));
        }
    }));
  }

  private downloadMatching(api: IExtensionApi, lookupResult: IModInfoEx,
                           pattern: string, referenceTag: string,
                           wasCanceled: () => boolean, campaign: string,
                           fileName?: string): Promise<string> {
    const modId: string = getSafe(lookupResult, ['details', 'modId'], undefined);
    const fileId: string = getSafe(lookupResult, ['details', 'fileId'], undefined);
    if ((modId === undefined) && (fileId === undefined)) {
      return this.downloadURL(api, lookupResult, wasCanceled, referenceTag, fileName);
    }

    const gameId = convertGameIdReverse(knownGames(api.getState()),
                                        lookupResult.domainName || lookupResult.gameId);

    return api.emitAndAwait('start-download-update',
      lookupResult.source, gameId, modId, fileId, pattern, campaign)
      .then((results: Array<{ error: Error, dlId: string }>) => {
        if ((results === undefined) || (results.length === 0)) {
          return Promise.reject(new NotFound(`source not supported "${lookupResult.source}"`));
        } else {
          if (!truthy(results[0])) {
            return Promise.reject(
              new ProcessCanceled('Download failed', { alreadyReported: true }));
          } else {
            const successResult = results.find(iter => iter.error === null);
            if (successResult === undefined) {
              return Promise.reject(results[0].error);
            } else {
              api.store.dispatch(setDownloadModInfo(results[0].dlId, 'referenceTag', referenceTag));
              return Promise.resolve(results[0].dlId);
            }
          }
        }
      });
  }

  private downloadDependencyAsync(
    requirement: IModReference,
    api: IExtensionApi,
    lookupResult: IModInfoEx,
    wasCanceled: () => boolean,
    fileName: string): Promise<string> {
    const referenceTag = requirement['tag'];
    const { campaign } = requirement['repo'] ?? {};

    if ((requirement.versionMatch !== undefined)
      && (!requirement.versionMatch.endsWith('+prefer') || lookupResult.archived)
      && isFuzzyVersion(requirement.versionMatch)) {
      // seems to be a fuzzy matcher so we may have to look for an update
      return this.downloadMatching(api, lookupResult, requirement.versionMatch,
                                   referenceTag, wasCanceled, campaign, fileName)
        .catch(err => {
          if (err instanceof HTTPError) {
            // assuming the api failed because the mod had been archive, can still download
            // the exact file specified by the curator
            return undefined;
          } else {
            return Promise.reject(err);
          }
        })
        .then(res => (res === undefined)
          ? this.downloadURL(api, lookupResult, wasCanceled, referenceTag, campaign, fileName)
          : res);
    } else {
      return this.downloadURL(api, lookupResult, wasCanceled, referenceTag, campaign, fileName)
        .catch(err => {
          if ((err instanceof UserCanceled) || (err instanceof ProcessCanceled)) {
            return Promise.reject(err);
          }
          // with +prefer versions, if the exact version isn't available, an update is acceptable
          if (requirement.versionMatch.endsWith('+prefer')) {
            return this.downloadMatching(api, lookupResult, requirement.versionMatch,
              referenceTag, wasCanceled, campaign, fileName);
          } else {
            return Promise.reject(err);
          }
        });
    }
  }

  private applyExtraFromRule(api: IExtensionApi,
                             gameId: string,
                             modId: string,
                             extra?: { [key: string]: any }) {
    if (extra === undefined) {
      return;
    }

    if (extra.type !== undefined) {
      api.store.dispatch(setModType(gameId, modId, extra.type));
    }

    const attributes = {};

    if (extra.name !== undefined) {
      attributes['customFileName'] = extra.name;
    }

    if (extra.url !== undefined) {
      attributes['source'] = 'website';
      attributes['url'] = extra.url;
    }

    if (extra.category !== undefined) {
      const categoryId = resolveCategoryId(extra.category, api.getState());
      if (categoryId !== undefined) {
        attributes['category'] = categoryId;
      }
    }

    if (extra.author !== undefined) {
      attributes['author'] = extra.author;
    }

    if (extra.version !== undefined) {
      attributes['version'] = extra.version;
    }

    api.store.dispatch(setModAttributes(gameId, modId, attributes));
  }

  private doInstallDependenciesPhase(api: IExtensionApi,
                                     dependencies: IDependency[],
                                     profile: IProfile,
                                     sourceModId: string,
                                     downloadAndInstall: (dep: IDependency) => Promise<string>,
                                     abort: AbortController)
                                     : Promise<IDependency[]> {
    const res: Promise<IDependency[]> = Promise.map(dependencies, (dep: IDependency) => {
      if (abort.signal.aborted) {
        return Promise.reject(new UserCanceled());
      }
      log('debug', 'installing as dependency', {
        ref: JSON.stringify(dep.reference),
        downloadRequired: dep.download === undefined,
      });

      const alreadyInstalled = dep.mod !== undefined;

      return downloadAndInstall(dep)
        .then((modId: string) => {
          log('info', 'installed as dependency', { modId });

          if (!alreadyInstalled) {
            api.store.dispatch(
              setModAttribute(profile.gameId, modId, 'installedAsDependency', true));
          }

          // enable the mod in any profile that has the source mod enabled
          const profiles = Object.values(api.getState().persistent.profiles)
            .filter(prof => (prof.gameId === profile.gameId)
                         && prof.modState?.[sourceModId]?.enabled);
          profiles.forEach(prof => {
            api.store.dispatch(setModEnabled(prof.id, modId, true));
          });

          this.applyExtraFromRule(api, profile.gameId, modId, dep.extra);

          const mods = api.store.getState().persistent.mods[profile.gameId];
          return { ...dep, mod: mods[modId] };
        })
        // don't cancel the whole process if one dependency fails to install
        .catch(ProcessCanceled, err => {
          if ((err.extraInfo !== undefined) && err.extraInfo.alreadyReported) {
            return Promise.resolve(undefined);
          }
          api.showErrorNotification('Failed to install dependency',
            '{{errorMessage}}\nA common cause for issues here is that the file may no longer '
            + 'be available. You may want to install a current version of the specified mod '
            + 'and update or remove the dependency for the old one.', {
            allowReport: false,
            message: renderModReference(dep.reference, undefined),
            replace: {
              errorMessage: err.message,
            },
          });
          return Promise.resolve(undefined);
        })
        .catch(DownloadIsHTML, () => {
          api.showErrorNotification('Failed to install dependency',
            'The direct download URL for this file is not valid or didn\'t lead to a file. '
            + 'This may be a setup error in the collection or the file has been moved.', {
              allowReport: false,
              message: renderModReference(dep.reference, undefined),
            });
        })
        .catch(NotFound, err => {
          api.showErrorNotification('Failed to install dependency', err, {
            message: renderModReference(dep.reference, undefined),
            allowReport: false,
          });
          return Promise.resolve(undefined);
        })
        .catch(err => {
          if (err instanceof UserCanceled) {
            if (err.skipped) {
              return Promise.resolve();
            } else {
              abort.abort();
              return Promise.reject(err);
            }
          } else if ([403, 404, 410].includes(err['statusCode'])) {
            api.showErrorNotification(
              'Failed to install dependency',
              'The mod seems to have been deleted and can no longer be downloaded.', {
              message: renderModReference(dep.reference, undefined),
              allowReport: false,
            });
            return Promise.resolve();
          } else if (err['statusCode'] >= 500) {
            api.showErrorNotification(
              'Failed to install dependency',
              'Server reported an internal error. This is likely a temporary issue, please '
              + 'try again later.', {
              message: renderModReference(dep.reference, undefined),
              allowReport: false,
            });
            return Promise.resolve();
          }

          const pretty = prettifyNodeErrorMessage(err);
          const newErr = new Error(pretty.message);
          newErr.stack = err.stack;
          api.showErrorNotification('Failed to install dependency', newErr, {
            message: renderModReference(dep.reference, undefined),
            allowReport: pretty.allowReport,
            replace: pretty.replace,
          });
          return Promise.resolve(undefined);
        })
        .then((updatedDependency: IDependency) => {
          log('debug', 'done installing dependency', {
            ref: JSON.stringify(dep.reference),
          });
          return updatedDependency;
        });
    })
      .finally(() => {
        delete this.mDependencyInstalls[sourceModId];
        log('info', 'done installing dependencies');
      })
      .catch(ProcessCanceled, err => {
        // This indicates an error in the dependency rules so it's
        // adequate to show an error but not as a bug in Vortex
        api.showErrorNotification('Failed to install dependencies',
          err.message, { allowReport: false });
        return [];
      })
      .catch(UserCanceled, () => {
        log('info', 'canceled out of dependency install');
        api.sendNotification({
          id: 'dependency-installation-canceled',
          type: 'info',
          message: 'Installation of dependencies canceled',
        });
        return [];
      })
      .catch(err => {
        api.showErrorNotification('Failed to install dependencies', err);
        return [];
      })
      .filter(dep => dep !== undefined);

    return res;
  }

  private doInstallDependencies(api: IExtensionApi,
                                profile: IProfile,
                                gameId: string,
                                sourceModId: string,
                                dependencies: IDependency[],
                                recommended: boolean,
                                silent: boolean): Promise<IDependency[]> {
    const state: IState = api.getState();
    let downloads: { [id: string]: IDownload } = state.persistent.downloads.files;

    const sourceMod = state.persistent.mods[gameId][sourceModId];
    const stagingPath = installPathForGame(state, gameId);

    let queuedDownloads: IModReference[] = [];

    const clearQueued = () => {
      const downloadsNow = api.getState().persistent.downloads.files;
      // cancel in reverse order so that canceling a running download doesn't
      // trigger a previously pending download to start just to then be canceled too.
      // Obviously this is probably not a robust way of achieving that but what is?
      queuedDownloads.reverse().forEach(ref => {
        const dlId = findDownloadByRef(ref, downloadsNow);
        log('info', 'cancel dependency dl', { name: renderModReference(ref), dlId });
        if (dlId !== undefined) {
          api.events.emit('pause-download', dlId);
        } else {
          api.events.emit('intercept-download', ref.tag);
        }
      });
      queuedDownloads = [];
    };

    const queueDownload = (dep: IDependency): Promise<string> => {
      return Promise.resolve(this.mDependencyDownloadsLimit.do<string>(() => {
        if (dep.reference.tag !== undefined) {
          queuedDownloads.push(dep.reference);
        }
        return abort.signal.aborted
          ? Promise.reject(new UserCanceled(false))
          : this.downloadDependencyAsync(
              dep.reference,
              api,
              dep.lookupResults[0].value,
              () => abort.signal.aborted,
              dep.extra?.fileName)
              .then(dlId => {
                const idx = queuedDownloads.indexOf(dep.reference);
                queuedDownloads.splice(idx, 1);
                return dlId;
              });
          }));
    };

    const resumeDownload = (dep: IDependency): Promise<string> => {
      return Promise.resolve(this.mDependencyDownloadsLimit.do<string>(() =>
        abort.signal.aborted
          ? Promise.reject(new UserCanceled(false))
          : new Promise((resolve, reject) => {
            api.events.emit('resume-download',
              dep.download,
              (err) => err !== null ? reject(err) : resolve(dep.download),
              { allowOpenHTML: false });
          })));
    };

    const installDownload = (dep: IDependency, downloadId: string)
        : Promise<string> => {
      return Promise.resolve(this.mDependencyInstallsLimit.do(() => {
        return abort.signal.aborted
          ? Promise.reject(new UserCanceled(false))
          : this.withInstructions(api,
                              modName(sourceMod),
                              renderModReference(dep.reference),
                              dep.extra?.['instructions'], () =>
          this.installModAsync(dep.reference, api, downloadId,
            { choices: dep.installerChoices }, dep.fileList,
            gameId, silent))
          .catch(err => {
            if (err instanceof UserCanceled) {
              err.skipped = true;
            }
            return Promise.reject(err);
          });
        }));
    };

    const doDownload = (dep: IDependency) => {
      let dlPromise = Promise.resolve(dep.download);

      if ((dep.download === undefined) || (downloads[dep.download] === undefined)) {
        if (dep.extra?.localPath !== undefined) {
          // the archive is shipped with the mod that has the dependency
          const downloadPath = downloadPathForGame(state, gameId);
          const fileName = path.basename(dep.extra.localPath);
          let targetPath = path.join(downloadPath, fileName);
          // backwards compatibility: during alpha testing the bundles were 7zipped inside
          // the collection
          if (path.extname(fileName) !== '.7z') {
            targetPath += '.7z';
          }
          dlPromise = fs.statAsync(targetPath)
            .then(() => Object.keys(downloads)
                .find(dlId => downloads[dlId].localPath === fileName))
            .catch(err => new Promise((resolve, reject) => {
              api.events.emit('import-downloads',
                [path.join(stagingPath, sourceMod.installationPath, dep.extra.localPath)],
                (dlIds: string[]) => {
                  if (dlIds.length > 0) {
                    api.store.dispatch(setDownloadModInfo(
                      dlIds[0], 'referenceTag', dep.reference.tag));
                    resolve(dlIds[0]);
                  } else {
                    resolve();
                  }
              }, true);
            }));
        } else {
          dlPromise = (dep.lookupResults[0]?.value?.sourceURI ?? '') === ''
            ? Promise.reject(new ProcessCanceled('Failed to determine download url'))
            : queueDownload(dep);
        }
      } else if (dep.download === null) {
        dlPromise = Promise.reject(new ProcessCanceled('Failed to determine download url'));
      } else if (downloads[dep.download].state === 'paused') {
        dlPromise = resumeDownload(dep);
      }
      return dlPromise
        .catch(AlreadyDownloaded, err => {
          if (err.downloadId !== undefined) {
            return Promise.resolve(err.downloadId);
          } else {
            const downloadId = Object.keys(downloads)
              .find(dlId => downloads[dlId].localPath === err.fileName);
            if (downloadId !== undefined) {
              return Promise.resolve(downloadId);
            }
          }
          return Promise.reject(new NotFound(`download for ${renderModReference(dep.reference)}`));
        })
        .then((downloadId: string) => {
          if ((downloadId !== undefined) && (downloads[downloadId]?.state === 'paused')) {
            return resumeDownload(dep);
          } else {
            return Promise.resolve(downloadId);
          }
        })
        .then((downloadId: string) => {
          downloads = api.getState().persistent.downloads.files;

          if ((downloadId === undefined) || (downloads[downloadId] === undefined)) {
            return Promise.reject(
              new NotFound(`download for ${renderModReference(dep.reference)}`));
          }
          if (downloads[downloadId].state !== 'finished') {
            // download not actually finished, may be paused
            return Promise.reject(new UserCanceled(true));
          }

          if ((dep.reference.tag !== undefined)
              && (downloads[downloadId].modInfo?.referenceTag !== undefined)
              && (downloads[downloadId].modInfo?.referenceTag !== dep.reference.tag)) {
            // we can't change the tag on the download because that might break
            // dependencies on the other mod
            // instead we update the rule in the collection. This has to happen immediately,
            // otherwise the installation might have weird issues around the mod
            // being installed having a different tag than the rule
            dep.reference = this.updateModRule(api, gameId, sourceModId, dep, {
              ...dep.reference,
              tag: downloads[downloadId].modInfo.referenceTag,
            }, recommended).reference;

            // now at this point there may in fact already be a mod for the updated reference tag
            if (dep.mod === undefined) {
              dep.mod = findModByRef(
                dep.reference, api.getState().persistent.mods[gameId]);
              log('info', 'updated mod', JSON.stringify(dep.mod));
            }
          } else {
            log('info', 'downloaded as dependency', { downloadId });
          }

          let queryWrongMD5 = Promise.resolve();
          if ((dep.mod === undefined)
              && (dep.lookupResults.length > 0)
              && (dep.lookupResults[0].value.fileMD5 !== undefined)
              && (dep.lookupResults[0].value.fileMD5 !== downloads[downloadId].fileMD5)) {
            log('info', 'mismatch md5', {
              expected: dep.lookupResults[0].value.fileMD5,
              got: downloads[downloadId].fileMD5,
            });
            queryWrongMD5 = api.showDialog('question', 'Unrecognized file {{name}}', {
              text: 'The signature for the file you selected to download for "{{name}}" does '
                  + 'not match the expected value. This is commonly caused by either '
                  + 'an incorrect selection or the required file having been updated or '
                  + 'modified since the dependency was set.\n\n'
                  + 'Would you like to keep the file you have downloaded or retry?',
              parameters: {
                name: renderModReference(dep.reference, dep.mod),
              },
            }, [
              { label: 'Retry' },
              { label: 'Use file anyway' },
            ])
            .then(result => (result.action === 'Retry')
              ? Promise.reject(new ProcessCanceled('retry invalid download'))
              : Promise.resolve());
          }

          return (dep.mod === undefined)
            ? queryWrongMD5
                .then(() => installDownload(dep, downloadId))
                .catch(err => {
                  if (dep['reresolveDownloadHint'] === undefined) {
                    return Promise.reject(err);
                  }
                  const download = downloads[downloadId];
                  const fullPath: string =
                    path.join(downloadPathForGame(state, download.game[0]), download.localPath);
                  return fs.removeAsync(fullPath)
                    .then(() => dep['reresolveDownloadHint']())
                    .then(() => doDownload(dep));
                })
            : Promise.resolve(dep.mod.id);
        });
    };

    const phases: { [phase: number]: IDependency[] } = {};

    dependencies.forEach(dep => setdefault(phases, dep.phase ?? 0, []).push(dep));

    const abort = new AbortController();

    abort.signal.onabort = () => clearQueued();

    const phaseList = Object.values(phases);

    const res: Promise<IDependency[]> = Promise.reduce(phaseList,
      (prev: IDependency[], depList: IDependency[], idx: number) => {
        if (depList.length === 0) {
          return prev;
        }
        return this.doInstallDependenciesPhase(api, depList, profile, sourceModId,
                                               doDownload, abort)
          .then((updated: IDependency[]) => {
            if (idx === phaseList.length - 1) {
              return Promise.resolve(updated);
            }
            return toPromise(cb => api.events.emit('deploy-mods', cb))
              .then(() => updated);
          })
          .then((updated: IDependency[]) => [].concat(prev, updated));
    }, []);

    this.mDependencyInstalls[sourceModId] = () => {
      abort.abort();
    };

    return res;
  }

  private updateModRule(api: IExtensionApi, gameId: string, sourceModId: string,
                        dep: IDependency, reference: IModReference, recommended: boolean) {
    const state: IState = api.store.getState();
    const rules: IModRule[] =
      getSafe(state.persistent.mods, [gameId, sourceModId, 'rules'], []);
    const oldRule = rules.find(iter => referenceEqual(iter.reference, dep.reference));

    const updatedRule: IRule = {
      ...(oldRule || {}),
      type: recommended ? 'recommends' : 'requires',
      reference,
    };

    api.store.dispatch(removeModRule(gameId, sourceModId, oldRule));
    api.store.dispatch(addModRule(gameId, sourceModId, updatedRule));
    return updatedRule;
  }

  private updateRules(api: IExtensionApi, gameId: string, sourceModId: string,
                      dependencies: IDependency[], recommended: boolean): Promise<void> {
    dependencies.forEach(dep => {
      const updatedRef: IModReference = { ...dep.reference };
      updatedRef.idHint = dep.mod?.id;

      this.updateModRule(api, gameId, sourceModId, dep, updatedRef, recommended);
    });
    return Promise.resolve();
  }

  private doInstallDependencyList(api: IExtensionApi,
                                  profile: IProfile,
                                  gameId: string,
                                  modId: string,
                                  name: string,
                                  dependencies: IDependency[],
                                  silent: boolean) {
    if (dependencies.length === 0) {
      return Promise.resolve();
    }

    interface IDependencySplit {
      success: IDependency[];
      existing: IDependency[];
      error: IDependencyError[];
    }
    const { success, existing, error } = dependencies.reduce(
      (prev: IDependencySplit, dep: Dependency) => {
        if (dep['error'] !== undefined) {
          prev.error.push(dep as IDependencyError);
        } else {
          const { mod } = dep as IDependency;
          if ((mod === undefined) || (!getSafe(profile?.modState, [mod.id, 'enabled'], false))) {
            prev.success.push(dep as IDependency);
          } else {
            prev.existing.push(dep as IDependency);
          }
        }
        return prev;
      }, { success: [], existing: [], error: [] });

    log('debug', 'determined unfulfilled dependencies',
      { count: success.length, errors: error.length });

    if (silent && (error.length === 0)) {
      return this.doInstallDependencies(api, profile, gameId, modId, success, false, silent)
        .then(updated => this.updateRules(api, gameId, modId, [].concat(existing, updated), false));
    }

    const state: IState = api.store.getState();
    const downloads = state.persistent.downloads.files;

    const requiredInstalls = success.filter(dep => dep.mod === undefined);
    const requiredDownloads = requiredInstalls.filter(dep => {
      return (dep.download === undefined)
        || (downloads[dep.download].state === 'paused');
    });

    let bbcode = '';

    if (success.length > 0) {
      bbcode += '{{modName}} has {{count}} unresolved dependencies. '
        + '{{instCount}} mods have to be installed, '
        + '{{dlCount}} of them have to be downloaded first.<br/><br/>';
    }

    if (error.length > 0) {
      bbcode += '[color=red]'
        + '{{modName}} has unsolved dependencies that could not be found automatically. '
        + 'Please install them manually:<br/>'
        + '{{errors}}'
        + '[/color]';
    }

    if (success.length === 0) {
      return Promise.resolve();
    }

    const actions = success.length > 0
      ? [
        { label: 'Don\'t install' },
        { label: 'Install' },
      ]
      : [{ label: 'Close' }];

    return api.store.dispatch(
      showDialog('question', 'Install Dependencies', {
        bbcode, parameters: {
          modName: name,
          count: success.length,
          instCount: requiredInstalls.length,
          dlCount: requiredDownloads.length,
          errors: error.map(err => err.error).join('<br/>'),
        },
      }, actions)).then(result => {
        if (result.action === 'Install') {
          return this.doInstallDependencies(api, profile, gameId, modId, success, false, silent)
            .then(updated => this.updateRules(api, gameId, modId,
              [].concat(existing, updated), false));
        } else {
          return Promise.resolve();
        }
      });

  }

  private installDependenciesImpl(api: IExtensionApi,
                                  profile: IProfile,
                                  gameId: string,
                                  modId: string,
                                  name: string,
                                  rules: IModRule[],
                                  installPath: string,
                                  silent: boolean)
                                  : Promise<void> {
    const filteredRules = (rules ?? []).filter(
          (rule: IModRule) => ['recommends', 'requires'].includes(rule.type)
                           && !rule.ignored);

    if (filteredRules.length === 0) {
      api.events.emit('did-install-dependencies', gameId, modId, false);
      return Promise.resolve();
    }

    const notificationId = `${installPath}_activity`;
    api.events.emit('will-install-dependencies', gameId, modId, false);

    let lastProgress = -1;

    const progress = silent ? nop : (perc: number) => {
      // rounded to steps of 5%
      const newProgress = Math.round(perc * 20) * 5;
      if (newProgress !== lastProgress) {
        lastProgress = newProgress;
        api.sendNotification({
          id: notificationId,
          type: 'activity',
          title: 'Checking dependencies',
          message: 'Resolving dependencies',
          progress: newProgress,
        });
      }
    };

    progress(0);
    api.store.dispatch(startActivity('dependencies', 'gathering'));

    log('debug', 'installing dependencies', { modId, name });
    return gatherDependencies(filteredRules, api, false, progress)
      .then((dependencies: IDependency[]) => {
        api.store.dispatch(stopActivity('dependencies', 'gathering'));
        api.dismissNotification(notificationId);
        return this.doInstallDependencyList(
          api, profile, gameId, modId, name, dependencies, silent);
      })
      .catch((err) => {
        api.dismissNotification(notificationId);
        api.store.dispatch(stopActivity('dependencies', 'gathering'));
        api.showErrorNotification('Failed to check dependencies', err);
      })
      .finally(() => {
        log('debug', 'done installing dependencies', { gameId, modId });
        api.events.emit('did-install-dependencies', gameId, modId, false);
      });
  }

  private installRecommendationsImpl(api: IExtensionApi,
                                     profile: IProfile,
                                     gameId: string,
                                     modId: string,
                                     name: string,
                                     rules: IRule[],
                                     installPath: string,
                                     silent: boolean)
                                     : Promise<void> {
    // TODO a lot of code duplication with installDependenciesImpl
    const filteredRules = (rules ?? []).filter(
          (rule: IModRule) => ['recommends', 'requires'].includes(rule.type)
                           && !rule.ignored);

    if (filteredRules.length === 0) {
      return Promise.resolve();
    }

    const notificationId = `${installPath}_activity`;
    api.events.emit('will-install-dependencies', profile?.id, modId, true);

    api.sendNotification({
      id: notificationId,
      type: 'activity',
      message: 'Checking dependencies',
    });
    api.store.dispatch(startActivity('dependencies', 'gathering'));
    return gatherDependencies(filteredRules, api, true, undefined)
      .then((dependencies: Dependency[]) => {
        api.store.dispatch(stopActivity('dependencies', 'gathering'));
        if (dependencies.length === 0) {
          return Promise.resolve();
        }

        interface IDependencySplit {
          success: IDependency[];
          existing: IDependency[];
          error: IDependencyError[];
        }
        const { success, existing, error } = dependencies.reduce(
          (prev: IDependencySplit, dep: Dependency) => {
            if (dep['error'] !== undefined) {
              prev.error.push(dep as IDependencyError);
            } else {
              const { mod } = dep as IDependency;
              if ((mod === undefined)
                  || !getSafe(profile?.modState, [mod.id, 'enabled'], false)) {
                prev.success.push(dep as IDependency);
              } else {
                prev.existing.push(dep as IDependency);
              }
            }
            return prev;
          }, { success: [], existing: [], error: [] });

        const state: IState = api.store.getState();
        const downloads = state.persistent.downloads.files;

        const requiredDownloads =
          success.reduce((prev: number, current: IDependency) => {
            const isDownloaded = current.download !== undefined
                              && downloads[current.download].state !== 'paused';
            return prev + (isDownloaded ? 0 : 1);
          }, 0);

        let bbcode = '';

        if (success.length > 0) {
          bbcode += '{{modName}} recommends the installation of additional mods. '
                   + 'Please use the checkboxes below to select which to install.<br/><br/>';
        }

        if (error.length > 0) {
          bbcode += '[color=red]'
            + '{{modName}} has unsolved dependencies that could not be found automatically. '
            + 'Please install them manually.'
            + '[/color]';
        }

        const checkboxes: ICheckbox[] = success.map((dep, idx) => {
          let depName: string;
          if (dep.lookupResults.length > 0) {
            depName = dep.lookupResults[0].value.fileName;
          }
          if (depName === undefined) {
            depName = renderModReference(dep.reference, undefined);
          }

          let desc = depName;
          if (dep.download === undefined) {
            desc += ' (' + api.translate('Not downloaded yet') + ')';
          }
          return {
            id: idx.toString(),
            text: desc,
            value: true,
          };
        });

        const actions = success.length > 0
          ? [
            { label: 'Don\'t install' },
            { label: 'Install' },
          ]
          : [ { label: 'Close' } ];

        let queryProm: Promise<IDialogResult> = Promise.resolve(null);

        if (!silent || (error.length > 0)) {
          queryProm = api.store.dispatch(
          showDialog('question', 'Install Recommendations', {
            bbcode,
            checkboxes,
            parameters: {
              modName: name,
              count: dependencies.length,
              dlCount: requiredDownloads,
            },
          }, actions));
        }

        return queryProm.then(result => {
            if ((result === null) || (result.action === 'Install')) {
              const selected = (result !== null)
                ? new Set(Object.keys(result.input).filter(key => result.input[key]))
                : undefined;

              return this.doInstallDependencies(
                api,
                profile,
                gameId,
                modId,
                (result !== null)
                  ? success.filter((dep, idx) => selected.has(idx.toString()))
                  : success,
                true, silent)
                .then(updated => this.updateRules(api, gameId, modId,
                  [].concat(existing, updated), true));
            } else {
              return Promise.resolve();
            }
          });
      })
      .catch((err) => {
        api.store.dispatch(stopActivity('dependencies', 'gathering'));
        api.showErrorNotification('Failed to check dependencies', err);
      })
      .finally(() => {
        api.dismissNotification(notificationId);
        api.events.emit('did-install-dependencies', gameId, modId, true);
      });
  }

  private withInstructions<T>(api: IExtensionApi,
                              sourceName: string,
                              title: string,
                              instructions: string,
                              cb: () => Promise<T>)
                              : Promise<T> {
    if (!truthy(instructions)) {
      return cb();
    }

    return api.showDialog('info', 'Installation notes for {{title}}', {
      text: 'The curator of "{{sourceName}}" has provided additional instructions '
          + 'for installing "{{title}}". You can view these instructions now or '
          + 'check them later from the instructions column in the collections view.',
      parameters: {
        title,
        sourceName,
      },
    }, [
      { label: 'Later' },
      { label: 'Show', action: () => {
        api.ext.showOverlay?.('install-instructions', title, instructions);
      } },
    ])
    .then(() => cb());
  }

  private installModAsync(requirement: IReference,
                          api: IExtensionApi,
                          downloadId: string,
                          modInfo?: any,
                          fileList?: IFileListItem[],
                          forceGameId?: string,
                          silent?: boolean): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const state = api.store.getState();
      const download: IDownload = state.persistent.downloads.files[downloadId];
      if (download === undefined) {
        return reject(new NotFound(renderModReference(requirement)));
      }
      const downloadGame: string[] = getDownloadGames(download);
      const fullPath: string =
        path.join(downloadPathForGame(state, downloadGame[0]), download.localPath);
      this.install(downloadId, fullPath, downloadGame,
        api, { ...modInfo, download }, false, false, (error, id) => {
          if (error === null) {
            resolve(id);
          } else {
            reject(error);
          }
        }, forceGameId, fileList, true, undefined, silent);
    });
  }

  private fixDestination(source: string, destination: string): Promise<string> {
    // if the source is an existing file an the destination is an existing directory,
    // copyAsync or renameAsync will not work, they expect the destination to be the
    // name of the output file.
    return fs.statAsync(source)
      .then(sourceStat => sourceStat.isDirectory()
        ? Promise.resolve(destination)
        : fs.statAsync(destination)
          .then(destStat => destStat.isDirectory()
            ? path.join(destination, path.basename(source))
            : destination))
      .catch(() => Promise.resolve(destination));
  }

  private transferFile(source: string, destination: string, move: boolean): Promise<void> {
    return fs.ensureDirAsync(path.dirname(destination))
      .then(() => this.fixDestination(source, destination))
      .then(fixedDest => move
        ? fs.renameAsync(source, fixedDest)
          .catch(err => (err.code === 'EXDEV')
            ? fs.copyAsync(source, fixedDest, { noSelfCopy: true })
            : Promise.reject(err))
        : fs.copyAsync(source, fixedDest, { noSelfCopy: true }));
  }

  /**
   * extract an archive
   *
   * @export
   * @param {string} archivePath path to the archive file
   * @param {string} destinationPath path to install to
   */
  private extractArchive(
    api: IExtensionApi,
    archivePath: string,
    tempPath: string,
    destinationPath: string,
    copies: IInstruction[],
    gameId: string): Promise<void> {
    let normalize: Normalize;

    const dlPath = downloadPathForGame(api.getState(), gameId);

    const missingFiles: string[] = [];
    return fs.ensureDirAsync(destinationPath)
        .then(() => getNormalizeFunc(destinationPath))
        .then((normalizeFunc: Normalize) => {
          normalize = normalizeFunc;
        })
        .then(() => {
          interface IDest {
            dest: string;
            section: string;
          }
          const sourceMap: {[src: string]: IDest[]} =
              copies.reduce((prev: { [src: string]: IDest[] }, copy) => {
                setdefault(prev, copy.source, [])
                  .push({ dest:  copy.destination, section: copy.section });
                return prev;
              }, {});
          // for each source, copy or rename to destination(s)
          return Promise.mapSeries(Object.keys(sourceMap), srcRel => {
            const sourcePath = path.join(tempPath, srcRel);
            // need to do this sequentially, otherwise we can't use the idx to
            // decide between rename and copy
            return Promise.mapSeries(sourceMap[srcRel], (dest, idx, len) => {
              // 'download' is currently the only supported section
              const destPath = (dest.section === 'download')
                ? path.join(dlPath, dest.dest)
                : path.join(destinationPath, dest.dest);

              return ((dest.section === 'download')
                ? fs.statAsync(destPath)
                  .then(() => false)
                  .catch(err => (err.code === 'ENOENT')
                    ? this.transferFile(sourcePath, destPath, idx === len - 1)
                      .then(() => true)
                    : Promise.reject(err))
                : this.transferFile(sourcePath, destPath, idx === len - 1)
                  .then(() => true)
              )
                .then(transferred => {
                  if ((dest.section === 'download') && transferred) {
                    const archiveId = shortid();
                    let fileSize: number;
                    return fs.statAsync(destPath)
                      .then(stat => {
                        fileSize = stat.size;
                        api.store.dispatch(
                          addLocalDownload(archiveId, gameId, dest.dest, fileSize));
                        return fileMD5(destPath);
                      })
                      .then(md5 => {
                        api.store.dispatch(setDownloadHashByFile(dest.dest, md5, fileSize));
                      });
                  } else {
                    return Promise.resolve();
                  }
                })
                .catch(err => {
                  if (err.code === 'ENOENT') {
                    missingFiles.push(srcRel);
                  } else if (err.code === 'EPERM') {
                    return this.transferFile(sourcePath, destPath, false);
                  } else {
                    return Promise.reject(err);
                  }
                });
            });
          });
        })
        .then(() => {
          if (missingFiles.length > 0) {
            api.showErrorNotification(api.translate('Invalid installer'),
              api.translate('The installer in "{{name}}" tried to install files that were '
                            + 'not part of the archive.\nThis is a bug in the mod, please '
                            + 'report it to the mod author.\n'
                            + 'Please note: NMM silently ignores this kind of errors so you '
                            + 'might get this message for mods that appear to install '
                            + 'fine with NMM. The mod will likely work, at least partially.',
                          { replace: {name: path.basename(archivePath)} })
              + '\n\n' + missingFiles.map(name => '- ' + name).join('\n')
            , { allowReport: false });
          }
        });
  }
}

export default InstallManager;
