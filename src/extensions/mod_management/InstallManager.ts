/* eslint-disable */
import { addLocalDownload, removeDownload, setDownloadHashByFile,
         setDownloadModInfo,
         startActivity, stopActivity } from '../../actions';
import { IConditionResult, IDialogContent, showDialog } from '../../actions/notifications';
import { ICheckbox, IDialogResult } from '../../types/IDialog';
import { IExtensionApi, ThunkStore } from '../../types/IExtensionContext';
import {IProfile, IState} from '../../types/IState';
import { getBatchContext, IBatchContext } from '../../util/BatchContext';
import { fileMD5 } from '../../util/checksum';
import ConcurrencyLimiter from '../../util/ConcurrencyLimiter';
import { DataInvalid, NotFound, ProcessCanceled, SetupError, TemporaryError,
         UserCanceled } from '../../util/CustomErrors';
import { createErrorReport, didIgnoreError,
        isOutdated, withContext } from '../../util/errorHandling';
import * as fs from '../../util/fs';
import getNormalizeFunc, { Normalize } from '../../util/getNormalizeFunc';
import { TFunction } from '../../util/i18n';
import lazyRequire from '../../util/lazyRequire';
import { log } from '../../util/log';
import { prettifyNodeErrorMessage } from '../../util/message';
import { activeGameId, activeProfile, downloadPathForGame, gameProfiles, installPathForGame, knownGames, lastActiveProfileForGame, profileById } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { batchDispatch, isPathValid, makeQueue, setdefault, toPromise, truthy } from '../../util/util';
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

import { MAX_VARIANT_NAME, MIN_VARIANT_NAME } from './constants';
import InstallContext from './InstallContext';
import makeListInstaller from './listInstaller';
import deriveModInstallName from './modIdManager';
import { STAGING_DIR_TAG } from './stagingDirectory';

import { HTTPError } from '@nexusmods/nexus-api';
import Bluebird from 'bluebird';
import * as _ from 'lodash';
import { IHashResult, ILookupResult, IReference, IRule } from 'modmeta-db';
import Zip = require('node-7z');
import * as os from 'os';
import * as path from 'path';
import * as Redux from 'redux';
import * as url from 'url';

import * as modMetaT from 'modmeta-db';

import { generate as shortid } from 'shortid';
import { IInstallOptions } from './types/IInstallOptions';

const {genHash} = lazyRequire<typeof modMetaT>(() => require('modmeta-db'));

export class ArchiveBrokenError extends Error {
  constructor(message: string) {
    super(`Archive is broken: ${message}`);

    this.name = this.constructor.name;
  }
}

type ReplaceChoice = 'replace' | 'variant';
interface IReplaceChoice {
  id: string;
  variant: string;
  enable: boolean;
  attributes: { [key: string]: any };
  rules: IRule[];
  replaceChoice: ReplaceChoice;
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

function validateVariantName(t: TFunction, content: IDialogContent): IConditionResult[] {
  const variantName = content.input.find(inp => inp.id === 'variant')?.value ?? '';

  if ((variantName.length < MIN_VARIANT_NAME) || (variantName.length > MAX_VARIANT_NAME)) {
    return [{
      id: 'variant',
      actions: ['Continue'],
      errorText: t('Name must be between {{min}}-{{max}} characters long', {
        replace: {
          min: MIN_VARIANT_NAME,
          max: MAX_VARIANT_NAME,
        },
      }),
    }];
  } else {
    return [];
  }
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
  private mQueue: Bluebird<void>;
  private mDependencyInstalls: { [modId: string]: () => void } = {};
  private mDependencyDownloadsLimit: ConcurrencyLimiter =
    new ConcurrencyLimiter(10);
  private mDependencyInstallsLimit: ConcurrencyLimiter =
    new ConcurrencyLimiter(3);
  private mDependencyQueue = makeQueue<void>();

  constructor(api: IExtensionApi, installPath: (gameId: string) => string) {
    this.mGetInstallPath = installPath;
    this.mQueue = Bluebird.resolve();

    api.onAsync(
      'install-from-dependencies',
      (dependentId: string, rules: IModRule[], recommended: boolean) => {
        const profile = activeProfile(api.getState());
        if (profile === undefined) {
          return Bluebird.reject(new ProcessCanceled('No game active'));
        }
        const { mods } = api.getState().persistent;
        const collection = mods[profile.gameId]?.[dependentId];

        if (collection === undefined) {
          return Bluebird.resolve();
        }

        const instPath = this.mGetInstallPath(profile.gameId);

        const filtered = rules.filter(iter =>
          collection.rules.find(rule => _.isEqual(iter, rule)) !== undefined);

        if (recommended) {
          return this.withDependenciesContext('install-recommendations', () =>
            this.installRecommendationsImpl(
              api, profile, profile.gameId, dependentId,
              modName(collection), filtered, instPath, true));
        } else {
          return this.withDependenciesContext('install-collections', () =>
            this.installDependenciesImpl(
              api, profile, profile.gameId, dependentId,
              modName(collection), filtered, instPath, true));
        }
      });

    api.onAsync('cancel-dependency-install', (modId: string) => {
      this.mDependencyInstalls[modId]?.();
      return Bluebird.resolve();
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

  public simulate(api: IExtensionApi, gameId: string,
                  archivePath: string, tempPath: string,
                  extractList?: IFileListItem[], unattended?: boolean,
                  installChoices?: any,
                  progress?: (entries: string[], percent: number) => void)
                  : Bluebird<IInstallResult> {
    if (this.mTask === undefined) {
      this.mTask = new Zip();
    }

    let extractProm: Bluebird<any>;
    if (FILETYPES_AVOID.includes(path.extname(archivePath).toLowerCase())) {
      extractProm = Bluebird.reject(new ArchiveBrokenError('file type on avoidlist'));
    } else {
      extractProm = this.mTask.extractFull(archivePath, tempPath, {ssc: false},
                                    progress,
                                    () => this.queryPassword(api.store) as any)
          .catch((err: Error) => this.isCritical(err.message)
            ? Bluebird.reject(new ArchiveBrokenError(err.message))
            : Bluebird.reject(err));
    }

    const fileList: string[] = [];

    return extractProm
        .then(({ code, errors }: {code: number, errors: string[] }) => {
          log('debug', 'extraction completed');
          if (code !== 0) {
            log('warn', 'extraction reported error', { code, errors: errors.join('; ') });
            const critical = errors.find(this.isCritical);
            if (critical !== undefined) {
              return Bluebird.reject(new ArchiveBrokenError(critical));
            }
            return this.queryContinue(api, errors, archivePath);
          } else {
            return Bluebird.resolve();
          }
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
                           return Bluebird.resolve();
                         }))
        .then(() => {
          if (truthy(extractList) && extractList.length > 0) {
            return makeListInstaller(extractList, tempPath);
          } else {
            return this.getInstaller(fileList, gameId, archivePath);
          }
        })
        .then(supportedInstaller => {
          if (supportedInstaller === undefined) {
            throw new Error('no installer supporting this file');
          }

          const {installer, requiredFiles} = supportedInstaller;

          return installer.install(
              fileList, tempPath, gameId,
              (perc: number) => {
                log('info', 'progress', perc);
                progress([], perc);
              },
              installChoices,
              unattended,
              archivePath);
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
    let installProfile = currentProfile;
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
        ? Bluebird.resolve(forceGameId)
        : queryGameId(api.store, downloadGameIds, modId))
      .then(async gameId => {
        installGameId = gameId;
        if (installGameId === undefined) {
          return Promise.reject(
            new ProcessCanceled('You need to select a game before installing this mod'));
        }
        if (installGameId === 'site' && baseName.toLowerCase().includes('extension')) {
          // Assumption here is that anything we try to install from the "Modding Tools"/"site" domain
          //  that contains "extension" in its archive name is an extension... If a non-extension tool
          //  contains "extension" in its archive name... well, that's not good but there's nothing we can
          //  do without API providing a unique tag for us to identify Vortex extensions. (AFAIK we can't even query the existing tags from the website)
          // Installation of non-Vortex tools with the extension basename will just install as a mod for
          //  the current game which I guess should be fine.
          return Promise.resolve(installGameId);
        }
        const state = api.getState();
        const games = knownGames(state);
        if (games.find(iter => iter.id === installGameId) === undefined) {
          return Bluebird.reject(new ProcessCanceled(`Game not supported "${installGameId}"`));
        }
        if (installGameId !== currentProfile?.gameId) {
          const installProfileId = lastActiveProfileForGame(state, installGameId);
          installProfile = profileById(state, installProfileId);
        }
        // TODO make the download first functionality optional
        await api.emitAndAwait('will-install-mod', gameId, archiveId, modId, fullInfo);
        return Bluebird.resolve(gameId);
      })
      // calculate the md5 hash here so we can store it with the mod meta information later,
      // otherwise we'd not remember the hash when installing from external file
      .tap(() => genHash(archivePath).then(hash => {
        archiveMD5 = hash.md5sum;
        archiveSize = hash.numBytes;
        try {
          _.merge(fullInfo, {
            download: {
              fileMD5: archiveMD5,
              size: archiveSize,
            },
          });
        } catch (err) {
          // no operation
        }
    }))
      .then(gameId => {
        if (installGameId === 'site') {
          // install an already-downloaded extension
          return api.emitAndAwait('install-extension-from-download', archiveId)
            .then(() => Bluebird.reject(new UserCanceled()));
        }
        const silent = unattended && allowAutoDeploy && enable;
        installContext = new InstallContext(gameId, api, silent);
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

        let variantCounter: number = 0;
        let replacementChoice: ReplaceChoice = undefined;
        const checkNameLoop = () => {
          if (replacementChoice === 'replace') {
            log('debug', '(nameloop) replacement choice "replace"', { testModId: testModId ?? '<undefined>' });
            return Promise.resolve(testModId);
          }
          const modNameMatches = this.checkModNameExists(testModId, api, installGameId);
          const variantMatches = this.checkModVariantsExist(api, installGameId, archiveId);
          const existingIds = ((replacementChoice === 'variant')
            ? modNameMatches
            : Array.from(new Set([].concat(modNameMatches, variantMatches))))
            .filter(_ => _ !== undefined);
          if (existingIds.length === 0) {
            log('debug', '(nameloop) no existing ids', { testModId: testModId ?? '<undefined>' });
            return Promise.resolve(testModId);
          } else {
            const installOptions: IInstallOptions = {
              ...info,
              unattended,
              variantNumber: ++variantCounter,
              fileList,
            };
            return this.queryUserReplace(api, existingIds, installGameId, installOptions)
              .then((choice: IReplaceChoice) => {
                if (choice.id === undefined) {
                  log('error', '(nameloop) no valid id selection', { testModId, modNameMatches, variantMatches });
                }
                testModId = choice.id;
                replacementChoice = choice.replaceChoice;
                if (choice.enable) {
                  enable = true;
                }
                setdefault(fullInfo, 'custom', {} as any).variant = choice.variant;
                rules = choice.rules || [];
                fullInfo.previous = choice.attributes;
                return checkNameLoop();
              });
          }
        }
        return checkNameLoop();
      })
      // TODO: this is only necessary to get at the fileId and the fileId isn't
      //   even a particularly good way to discover conflicts
      .then(newModId => {
        if (newModId === undefined) {
          // this shouldn't be possible, how would checkNameLoop return undefined?
          const err = new Error('failed to generate mod id');
          err['originalModId'] = modId;
          err['archivePath'] = archivePath;
          return Bluebird.reject(err);
        }
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
          return Bluebird.resolve();
        }
      })
      .then(() => {
        if ((existingMod !== undefined) && (fullInfo.choices === undefined)) {
          fullInfo.choices = getSafe(existingMod, ['attributes', 'installerChoices'], undefined);
        }

        if ((existingMod !== undefined) && (installProfile !== undefined)) {
          const wasEnabled = getSafe(installProfile.modState, [existingMod.id, 'enabled'], false);
          return this.userVersionChoice(existingMod, api.store)
            .then((action: string) => {
              if (action === INSTALL_ACTION) {
                enable = enable || wasEnabled;
                if (wasEnabled) {
                  setModsEnabled(api, installProfile.id, [existingMod.id], false, {
                    allowAutoDeploy,
                    installed: true,
                  });
                }
                rules = existingMod.rules || [];
                overrides = existingMod.fileOverrides;
                fullInfo.previous = existingMod.attributes;
                return Bluebird.resolve();
              } else if (action === REPLACE_ACTION) {
                rules = existingMod.rules || [];
                overrides = existingMod.fileOverrides;
                fullInfo.previous = existingMod.attributes;
                // we need to remove the old mod before continuing. This ensures
                // the mod is deactivated and undeployed (so we're not leave dangling
                // links) and it ensures we do a clean install of the mod
                return new Bluebird<void>((resolve, reject) => {
                  api.events.emit('remove-mod', installGameId, existingMod.id,
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
          return Bluebird.resolve();
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
          return Bluebird.resolve(result);
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
          return Bluebird.resolve();
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
        if (installProfile !== undefined) {
          if (enable) {
            setModsEnabled(api, installProfile.id, [modId], true, {
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
          : Bluebird.resolve();

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
                if (err.message.includes('No compatible .NET installation')) {
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
                             allowAutoDeploy: boolean): Bluebird<void> {
    const state: IState = api.store.getState();
    const mod: IMod = state.persistent.mods[gameId]?.[modId];

    if (mod === undefined) {
      return Bluebird.reject(new ProcessCanceled(`Invalid mod specified "${modId}"`));
    }

    this.repairRules(api, mod, gameId);

    const installPath = this.mGetInstallPath(gameId);
    log('info', 'start installing dependencies');

    api.store.dispatch(startActivity('installing_dependencies', mod.id));
    return this.withDependenciesContext('install-dependencies', () =>
      this.augmentRules(api, gameId, mod)
        .then(rules => this.installDependenciesImpl(
          api, profile, gameId, mod.id, modName(mod), rules,
          installPath, allowAutoDeploy))
        .finally(() => {
          log('info', 'done installing dependencies');
          api.store.dispatch(stopActivity('installing_dependencies', mod.id));
        }));
  }

  public installRecommendations(api: IExtensionApi,
                                profile: IProfile,
                                gameId: string,
                                modId: string)
                                : Bluebird<void> {
    const state: IState = api.store.getState();
    const mod: IMod = getSafe(state, ['persistent', 'mods', gameId, modId], undefined);

    if (mod === undefined) {
      return Bluebird.reject(new ProcessCanceled(`Invalid mod specified "${modId}"`));
    }

    this.repairRules(api, mod, gameId);

    const installPath = this.mGetInstallPath(gameId);
    log('info', 'start installing recommendations');

    api.store.dispatch(startActivity('installing_dependencies', mod.id));
    return this.withDependenciesContext('install-recommendations', () =>
      this.augmentRules(api, gameId, mod)
        .then(rules => this.installRecommendationsImpl(
          api, profile, gameId, mod.id, modName(mod),
          rules, installPath, false))
        .finally(() => {
          log('info', 'done installing recommendations');
          api.store.dispatch(stopActivity('installing_dependencies', mod.id));
        })
    );
  }

  private augmentRules(api: IExtensionApi, gameId: string, mod: IMod): Bluebird<IRule[]> {
    const rules = (mod.rules ?? []).slice();
    if (mod.attributes === undefined) {
      return Bluebird.resolve(rules);
    }

    return api.lookupModMeta({
      fileMD5: mod.attributes['fileMD5'],
      fileSize: mod.attributes['fileSize'],
      gameId: mod.attributes['downloadGame'] ?? gameId,
    })
      .then(results => {
        rules.push(...(results[0]?.value?.rules ?? []));
        return Bluebird.resolve(rules);
      })
  }

  private withDependenciesContext<T>(contextName: string, func: () => Bluebird<T>): Bluebird<T> {
    const context = getBatchContext(contextName, '', true);
    context.set('depth', context.get('depth', 0) + 1);
    context.set('remember-instructions', null);

    return func()
      .finally(() => {
        const oldDepth = context.get<number>('depth', 0);
        context.set('depth', oldDepth - 1);
        if (oldDepth === 1) {
          context.set('remember', null);
        }
      });
  }

  private hasFuzzyReference(ref: IModReference): boolean {
    return (ref.fileExpression !== undefined)
        || (ref.fileMD5 !== undefined)
        || (ref.logicalFileName !== undefined);
  }

  private setModSize(api: IExtensionApi, modId: string, gameId: string): Bluebird<void> {
    const state = api.getState();
    const stagingFolder = installPathForGame(state, gameId);
    const mod = state.persistent.mods[gameId]?.[modId];
    if (mod?.installationPath === undefined) {
      log('debug', 'failed to calculate modSize', 'mod is not in state');
      return Bluebird.resolve();
    }
    const modPath = path.join(stagingFolder, mod.installationPath);
    return calculateFolderSize(modPath)
    .then((totalSize) => {
      api.store.dispatch(setModAttribute(gameId, mod.id, 'modSize', totalSize));
      return Bluebird.resolve();
    })
    .catch(err => {
      log('debug', 'failed to calculate modSize', err);
      return Bluebird.resolve();
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
        // used to be "Can not", current 7z prints "Cannot"
        || (error.indexOf('Cannot open the file as archive') !== -1)
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
                       unattended?: boolean): Bluebird<IInstallResult> {
    const fileList: string[] = [];
    let phase = 'Extracting';

    const progress = (files: string[], percent: number) => {
      if ((percent !== undefined) && (installContext !== undefined)) {
        installContext.setProgress(phase, percent);
      }
    };
    log('debug', 'extracting mod archive', { archivePath, tempPath });
    let extractProm: Bluebird<any>;
    if (FILETYPES_AVOID.includes(path.extname(archivePath).toLowerCase())) {
      extractProm = Bluebird.reject(new ArchiveBrokenError('file type on avoidlist'));
    } else {
      extractProm = this.mTask.extractFull(archivePath, tempPath, {ssc: false},
                                    progress,
                                    () => this.queryPassword(api.store) as any)
          .catch((err: Error) => this.isCritical(err.message)
            ? Bluebird.reject(new ArchiveBrokenError(err.message))
            : Bluebird.reject(err));
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
              return Bluebird.reject(new ArchiveBrokenError(critical));
            }
            return this.queryContinue(api, errors, archivePath);
          } else {
            return Bluebird.resolve();
          }
        })
        .catch(ArchiveBrokenError, err => {
          if (archiveExtLookup.has(path.extname(archivePath).toLowerCase())) {
            // hmm, it was supposed to support the file type though...
            return Bluebird.reject(err);
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
              ]).then(() => Bluebird.reject(new ProcessCanceled('Not a mod')));
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
                return Bluebird.reject(new UserCanceled());
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
                           return Bluebird.resolve();
                         }))
        .finally(() => {
          // process.noAsar = false;
        })
        .then(() => {
          if (truthy(extractList) && extractList.length > 0) {
            return makeListInstaller(extractList, tempPath);
          } else if (forceInstaller === undefined) {
            return this.getInstaller(fileList, gameId, archivePath);
          } else {
            const forced = this.mInstallers.find(inst => inst.id === forceInstaller);
            return forced.testSupported(fileList, gameId, archivePath)
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
              unattended,
              archivePath);
        });
  }

  private determineModType(gameId: string, installInstructions: IInstruction[]): Bluebird<string> {
    log('info', 'determine mod type', { gameId });
    const game = getGame(gameId);
    if (game === undefined) {
      return Bluebird.reject(new Error(`Invalid game "${gameId}"`));
    }
    const modTypes: IModType[] = game.modTypes;
    const sorted = modTypes.sort((lhs, rhs) => lhs.priority - rhs.priority);
    let found = false;

    return Bluebird.mapSeries(sorted, (type: IModType): Bluebird<string> => {
      if (found) {
        return Bluebird.resolve<string>(null);
      }

      try {
        return type.test(installInstructions)
          .then(matches => {
            if (matches) {
              found = true;
              return Bluebird.resolve(type.typeId);
            } else {
              return Bluebird.resolve(null);
            }
          });
      } catch (err) {
        log('error', 'invalid mod type', { typeId: type.typeId, error: err.message });
        return Bluebird.resolve(null);
      }
    }).then(matches => matches.find(match => match !== null) || '');
  }

  private queryContinue(api: IExtensionApi,
                        errors: string[],
                        archivePath: string): Bluebird<void> {
    const terminal = errors.find(err => err.indexOf('Can not open the file as archive') !== -1);

    return new Bluebird<void>((resolve, reject) => {
      const actions = [
        { label: 'Cancel', action: () => reject(new UserCanceled()) },
        { label: 'Delete', action: () => {
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

  private queryPassword(store: ThunkStore<any>): Bluebird<string> {
    return new Bluebird<string>((resolve, reject) => {
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
                       destinationPath: string): Bluebird<void> {
    return Bluebird.each(instructions,
                        instruction => fs.ensureDirAsync(path.join(
                            destinationPath, instruction.destination)))
        .then(() => undefined);
  }

  private processGenerateFiles(generatefile: IInstruction[],
                               destinationPath: string): Bluebird<void> {
    return Bluebird.each(generatefile, gen => {
      const outputPath = path.join(destinationPath, gen.destination);
      return fs.ensureDirAsync(path.dirname(outputPath))
        // data buffers are sent to us base64 encoded
        .then(() => fs.writeFileAsync(outputPath, gen.data));
    }).then(() => undefined);
  }

  private processSubmodule(api: IExtensionApi, submodule: IInstruction[],
                           destinationPath: string,
                           gameId: string, modId: string,
                           choices: any, unattended: boolean): Bluebird<void> {
    return Bluebird.each(submodule,
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
                           gameId: string, modId: string): Bluebird<void> {
    attribute.forEach(attr => {
      api.store.dispatch(setModAttribute(gameId, modId, attr.key, attr.value));
    });
    return Bluebird.resolve();
  }

  private processEnableAllPlugins(api: IExtensionApi, enableAll: IInstruction[],
                                  gameId: string, modId: string): Bluebird<void> {
    if (enableAll.length > 0) {
      api.store.dispatch(setModAttribute(gameId, modId, 'enableallplugins', true));
    }
    return Bluebird.resolve();
  }

  private processSetModType(api: IExtensionApi, types: IInstruction[],
                            gameId: string, modId: string): Bluebird<void> {
    if (types.length > 0) {
      api.store.dispatch(setModType(gameId, modId, types[types.length - 1].value));
      if (types.length > 1) {
        log('error', 'got more than one mod type, only the last was used', { types });
      }
    }
    return Bluebird.resolve();
  }

  private processRule(api: IExtensionApi, rules: IInstruction[],
                      gameId: string, modId: string): Bluebird<void> {
    rules.forEach(rule => {
      api.store.dispatch(addModRule(gameId, modId, rule.rule));
    });
    return Bluebird.resolve();
  }

  private processIniEdits(api: IExtensionApi,
                          iniEdits: IInstruction[],
                          destinationPath: string,
                          gameId: string, modId: string): Bluebird<void> {
    if (iniEdits.length === 0) {
      return Bluebird.resolve();
    }

    const byDest: { [dest: string]: IInstruction[] } = iniEdits.reduce(
      (prev: { [dest: string]: IInstruction[] }, value) => {
      setdefault(prev, value.destination, []).push(value);
      return prev;
    }, {});

    return fs.ensureDirAsync(path.join(destinationPath, INI_TWEAKS_PATH))
      .then(() => Bluebird.map(Object.keys(byDest), destination => {
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
      return Bluebird.reject(new UserCanceled());
    }

    if ((result.instructions === undefined) ||
        (result.instructions.length === 0)) {
      return Bluebird.reject(new ProcessCanceled('Empty archive or no options selected'));
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
      return Bluebird.reject(new ProcessCanceled('Invalid installer instructions'));
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
        return Bluebird.reject(new ProcessCanceled('Installer script failed'));
      }
    }

    // log('debug', 'installer instructions',
    //     JSON.stringify(result.instructions.map(instr => _.omit(instr, ['data']))));
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

  private checkModVariantsExist(api: IExtensionApi, gameMode: string, archiveId: string): string[] {
    if (archiveId === null) {
      return [];
    }
    const state = api.getState();
    const mods = Object.values(state.persistent.mods[gameMode] || []);
    return mods.filter(mod => mod.archiveId === archiveId).map(mod => mod.id);
  }

  private checkModNameExists(installName: string, api: IExtensionApi, gameMode: string): string[] {
    const state = api.getState();
    const mods = Object.values(state.persistent.mods[gameMode] || []);
    // Yes I know that only 1 mod id can ever match the install name, but it's more consistent
    //  with the variant check as we don't have to check for undefined too.
    return mods.filter(mod => mod.id === installName).map(mod => mod.id);
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
                               : Bluebird<void> {
    return new Bluebird<void>((resolve, reject) => {
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

  private queryProfileCount(store: ThunkStore<any>): number {
    const state = store.getState();
    const profiles = gameProfiles(state);
    return profiles.length;
  }

  private userVersionChoice(oldMod: IMod, store: ThunkStore<any>): Bluebird<string> {
    const totalProfiles = this.queryProfileCount(store);
    return (totalProfiles === 1)
      ? Bluebird.resolve(REPLACE_ACTION)
      : new Bluebird<string>((resolve, reject) => {
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

  private queryUserReplace(api: IExtensionApi, modIds: string[], gameId: string, installOptions: IInstallOptions) {
    return new Bluebird<IReplaceChoice>((resolve, reject) => {
      const state: IState = api.store.getState();
      const mods: IMod[] = Object.values(state.persistent.mods[gameId])
        .filter(mod => modIds.includes(mod.id));
      if (mods.length === 0) {
        // Technically for this to happen the timing must be *perfect*,
        //  the replace query dialog will only show if we manage to confirm that
        //  the modId is indeed stored persistently - but if somehow the user
        //  was able to finish removing the mod right as the replace dialog
        //  appears the mod could be potentially missing from the state.
        // In this case we resolve using the existing modId.
        // https://github.com/Nexus-Mods/Vortex/issues/7972
        const currentProfile = activeProfile(api.store.getState());
        return resolve({
          id: modIds[0],
          variant: '',
          enable: getSafe(currentProfile, ['modState', modIds[0], 'enabled'], false),
          attributes: {},
          rules: [],
          replaceChoice: 'replace',
        });
      }

      const context = getBatchContext('install-mod', mods[0].archiveId);

      const queryVariantNameDialog = (remember: boolean) => {
        const checkVariantRemember: ICheckbox[] = [];
        if (truthy(context)) {
          const itemsCompleted = context.get('items-completed', 0);
          const itemsLeft = context.itemCount - itemsCompleted;
          if ((itemsLeft > 1) && remember) {
            checkVariantRemember.push({
              id: 'remember',
              value: false,
              text: api.translate('Use this name for all remaining variants ({{count}} more)', {
                count: itemsLeft - 1,
              }),
            });
          }
        }

        return api.showDialog('question', 'Install options - Name mod variant', {
          text: 'Enter a variant name for "{{modName}}" to differentiate it from the original',
          input: [{
            id: 'variant',
            value: installOptions.variantNumber > 2 ? installOptions.variantNumber.toString() : '2',
            label: 'Variant',
          }],
          checkboxes: checkVariantRemember,
          md: '**Remember:** You can switch between variants by clicking in the version '
            + 'column in your mod list and selecting from the dropdown.',
          parameters: {
            modName: modName(mods[0], { version: false }),
          },
          condition: (content: IDialogContent) => validateVariantName(api.translate, content),
          options: {
            order: ['text', 'input', 'md', 'checkboxes'],
          },
        }, [
          { label: 'Cancel' },
          { label: 'Continue' },
        ])
        .then(result => {
          if (result.action === 'Cancel') {
            context?.set?.('canceled', true);
            return Bluebird.reject(new UserCanceled());
          } else {
            if (result.input.remember) {
              context.set('variant-name', result.input.variant);
            }
            return Bluebird.resolve(result.input.variant);
          }
        });
      };

      const mod = mods[0];
      const modReference: IModReference = {
        id: mod.id,
        fileList: installOptions?.fileList,
        archiveId: mod.archiveId,
        gameId,
        installerChoices: installOptions?.choices,
        patches: installOptions?.patches,
      }
      const isDependency = (installOptions?.unattended === true) && (testModReference(mods[0], modReference) === false);
      const addendum = isDependency
        ? ' and is trying to be reinstalled as a dependency by another mod or collection.'
        : '.'

      const queryDialog = () => api.showDialog('question', 'Install options',
        {
          bbcode: api.translate(`"{{modName}}" is already installed on your system${addendum}` + '[br][/br][br][/br]Would you like to:',
            { replace: { modName: modName(mods[0], { version: false }), } }),
          choices: [
            {
              id: 'replace',
              value: true,
              text: 'Replace the existing mod' + (isDependency ? ' (recommended)' : ''),
              subText: 'This will replace the existing mod on all your profiles.',
            },
            {
              id: 'variant',
              value: false,
              text: 'Install as variant of the existing mod',
              subText: 'This will allow you to install variants of the same mod and easily '
                     + 'switch between them from the version drop-down in the mods table. '
                     + 'This can be useful if you want to install the same mod but with '
                     + 'different options in different profiles.',
            },
          ],
          checkboxes: checkRoVRemember,
          options: {
            wrap: true,
            order: ['choices', 'checkboxes'],
          },
          parameters: {
            modName: modName(mods[0], { version: false }),
          },
        },
        [
          { label: 'Cancel' },
          { label: 'Continue' },
        ])
        .then(result => {
          if (result.action === 'Cancel') {
            context?.set?.('canceled', true);
            return Bluebird.reject(new UserCanceled());
          } else if (result.input.variant) {
            return queryVariantNameDialog(result.input.remember)
              .then(variant => ({
                action: 'variant',
                variant,
                remember: result.input.remember,
              }));
          } else if (result.input.replace) {
            return {
              action: 'replace',
              remember: result.input.remember,
            };
          }
        });

        const queryVariantReplacement = () => api.showDialog('question', 'Select Variant to Replace',
        {
          text: '"{{modName}}" has several variants installed - please choose which one to replace:',
          choices: modIds.map((id, idx) => {
            const modAttributes = mods[idx].attributes;
            const variant = getSafe(modAttributes, ['variant'], '');
            return {
              id,
              value: idx === 0,
              text: `modId: ${id}`,
              subText: api.translate('Version: {{version}}; InstallTime: {{installTime}}; Variant: {{variant}}',
              {
                replace: {
                  version: getSafe(modAttributes, ['version'], 'Unknown'),
                  installTime: new Date(getSafe(modAttributes, ['installTime'], 0)),
                  variant: truthy(variant) ? variant : 'Not set',
                }
              }),
            }
          }),
          parameters: {
            modName: modName(mods[0], { version: false }),
          },
        },
        [
          { label: 'Cancel' },
          { label: 'Continue' },
        ]);

      let choices: Bluebird<{ action: string, variant?: string, remember: boolean }>;

      const checkRoVRemember: ICheckbox[] = [];
      if (context !== undefined) {
        if (context.get('canceled', false)) {
          return reject(new UserCanceled());
        }

        const action = context.get('replace-or-variant');
        const itemsCompleted = context.get('items-completed', 0);
        const itemsLeft = context.itemCount - itemsCompleted;
        if (itemsLeft > 1) {
          if (action === undefined) {
            checkRoVRemember.push({
              id: 'remember',
              value: false,
              text: api.translate('Do this for all remaining reinstalls ({{count}} more)', {
                count: itemsLeft - 1,
              }),
            });
          }
        }

        if (action !== undefined) {
          let variant: string = context.get('variant-name');
          if ((action === 'variant') && (variant === undefined)) {
            choices = queryVariantNameDialog(context.get('replace-or-variant') !== undefined)
              .then(variantName => ({
                action,
                variant: variantName,
                remember: true,
              }));
          } else {
            if ((variant !== undefined) && (installOptions.variantNumber > 1)) {
              variant += `.${installOptions.variantNumber}`;
            }
            choices = Bluebird.resolve({
              action,
              variant,
              remember: true,
            });
          }
        }
      }

      if (choices === undefined) {
        choices = isDependency ? Bluebird.resolve({ action: 'replace', remember: true }) : queryDialog();
      }

      choices
        .then((result: { action: string, variant: string, remember: boolean }) => {
          const currentProfile = activeProfile(api.store.getState());
          const wasEnabled = (modId: string) => {
            return (currentProfile?.gameId === gameId)
              ? getSafe(currentProfile.modState, [modId, 'enabled'], false)
              : false;
          };

          const replaceMod = (modId: string) => {
            const mod = mods.find(m => m.id === modId);
            const variant = mod !== undefined ? getSafe(mod.attributes, ['variant'], '') : '';
            api.events.emit('remove-mod', gameId, modId, (err) => {
              if (err !== null) {
                reject(err);
              } else {
                resolve({
                  id: modId,
                  variant,
                  enable: wasEnabled(modId),
                  attributes: _.omit(mod.attributes, ['version', 'fileName', 'fileVersion']),
                  rules: mod.rules,
                  replaceChoice: 'replace',
                });
              }
            }, { willBeReplaced: true });
          };

          if (result.action === 'variant') {
            if (result.remember === true) {
              context?.set?.('replace-or-variant', 'variant');
            }
            if (currentProfile !== undefined) {
              const actions = modIds.map(id => setModEnabled(currentProfile.id, id, false));
              batchDispatch(api.store.dispatch, actions);
            }
            // We want the shortest possible modId paired against this archive
            //  before adding the variant name to it.
            const archiveId = mods[0].archiveId;
            const relevantIds = Object.keys(state.persistent.mods[gameId])
              .filter(id => state.persistent.mods[gameId][id]?.archiveId === archiveId);
            const modId = relevantIds.reduce((prev, iter) => iter.length < prev.length ? iter : prev, relevantIds[0]);
            // We just disabled all variants - if any of the variants was enabled previously
            //  it's safe to assume that the user wants this new variant enabled.
            const enable = modIds.reduce((prev, iter) => wasEnabled(iter) ? true : prev, false);
            resolve({
              id: modId + '+' + result.variant,
              variant: result.variant,
              enable,
              attributes: {},
              rules: [],
              replaceChoice: 'variant',
            });
          } else if (result.action === 'replace') {
            if (result.remember === true) {
              context?.set?.('replace-or-variant', 'replace');
            }
            if (modIds.length > 1) {
              queryVariantReplacement()
                .then((res: IDialogResult) => {
                  if (res.action === 'Cancel') {
                    context?.set?.('canceled', true);
                    reject(new UserCanceled());
                  } else {
                    const selected = Object.keys(res.input).find(iter => res.input[iter]);
                    replaceMod(selected);
                  }
                })
            } else {
              replaceMod(modIds[0]);
            }
          } else {
            if (result.action === 'Cancel') {
              log('error', 'invalid action in "queryUserReplace"', { action: result.action });
            }
            context?.set?.('canceled', true);
            reject(new UserCanceled());
          }
        })
        .tap(() => {
          if (context !== undefined) {
            context.set('items-completed', context.get('items-completed', 0) + 1);
          }
        })
        .catch(err => {
          return reject(err);
        })
        ;
    });
  }

  private getInstaller(
    fileList: string[],
    gameId: string,
    archivePath: string,
    offsetIn?: number,
    ): Bluebird<ISupportedInstaller> {
    const offset = offsetIn || 0;
    if (offset >= this.mInstallers.length) {
      return Bluebird.resolve(undefined);
    }
    return Bluebird.resolve(this.mInstallers[offset].testSupported(fileList, gameId, archivePath))
      .then((testResult: ISupportedResult) => {
          if (testResult === undefined) {
            log('error', 'Buggy installer', this.mInstallers[offset].id);
          }
          return (testResult?.supported === true)
            ? Bluebird.resolve({
              installer: this.mInstallers[offset],
              requiredFiles: testResult.requiredFiles,
            })
            : this.getInstaller(fileList, gameId, archivePath, offset + 1);
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
                      fileName?: string): Bluebird<string> {
    const call = (input: string | (() => Bluebird<string>)): Bluebird<string> =>
      (input !== undefined) && (typeof(input) === 'function')
      ? input() : Bluebird.resolve(input as string);

    let resolvedSource: string;
    let resolvedReferer: string;

    return call(lookupResult.sourceURI).then(res => resolvedSource = res)
      .then(() => call(lookupResult.referer).then(res => resolvedReferer = res))
      .then(() => new Bluebird<string>((resolve, reject) => {
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
          async (error, id) => {
            if (error === null) {
              return resolve(id);
            } else if (error instanceof AlreadyDownloaded) {
              return resolve(error.downloadId);
            } else if (error instanceof DownloadIsHTML){
              // If this is a google drive link and the file exceeds the
              //  virus testing limit, Google will return an HTML page asking
              //  the user for consent to download the file. Lets try this using
              //  the browser extension.
              const instructions = `You are trying to download "${lookupResult.fileName}" from "${resolvedSource}".\n`
                                 + 'Depending on the portal, you may be re-directed several times.';
              const result: string[] = await api.emitAndAwait('browse-for-download', resolvedSource, instructions);
              if (result.length > 0) {
                const newLookupRes = { ...lookupResult, sourceURI: result[0] };
                const id = await this.downloadURL(api, newLookupRes, wasCanceled, referenceTag, campaign, fileName);
                return resolve(id);
              } else {
                return reject(new UserCanceled());
              }
            } else {
              return reject(error);
            }
          }, 'never', { allowInstall: false, allowOpenHTML: false })) {
          return reject(new Error('download manager not installed?'));
        }
    }));
  }

  private downloadMatching(api: IExtensionApi, lookupResult: IModInfoEx,
                           pattern: string, referenceTag: string,
                           wasCanceled: () => boolean, campaign: string,
                           fileName?: string): Bluebird<string> {
    const modId: string = getSafe(lookupResult, ['details', 'modId'], undefined);
    const fileId: string = getSafe(lookupResult, ['details', 'fileId'], undefined);
    if ((modId === undefined) && (fileId === undefined)) {
      return this.downloadURL(api, lookupResult, wasCanceled, referenceTag, fileName);
    }

    const gameId = convertGameIdReverse(knownGames(api.getState()),
                                        lookupResult.domainName || lookupResult.gameId);

    return api.emitAndAwait('start-download-update',
      lookupResult.source, gameId, modId, fileId, pattern, campaign, referenceTag)
      .then((results: Array<{ error: Error, dlId: string }>) => {
        if ((results === undefined) || (results.length === 0)) {
          return Bluebird.reject(new NotFound(`source not supported "${lookupResult.source}"`));
        } else {
          if (!truthy(results[0])) {
            return Bluebird.reject(
              new ProcessCanceled('Download failed', { alreadyReported: true }));
          } else {
            const successResult = results.find(iter => iter.error === null);
            if (successResult === undefined) {
              return Bluebird.reject(results[0].error);
            } else {
              api.store.dispatch(setDownloadModInfo(results[0].dlId, 'referenceTag', referenceTag));
              return Bluebird.resolve(results[0].dlId);
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
    fileName: string): Bluebird<string> {
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
            return Bluebird.reject(err);
          }
        })
        .then(res => (res === undefined)
          ? this.downloadURL(api, lookupResult, wasCanceled, referenceTag, campaign, fileName)
          : res);
    } else {
      return this.downloadURL(api, lookupResult, wasCanceled, referenceTag, campaign, fileName)
        .catch(err => {
          if ((err instanceof UserCanceled) || (err instanceof ProcessCanceled)) {
            return Bluebird.reject(err);
          }
          // with +prefer versions, if the exact version isn't available, an update is acceptable
          if (requirement.versionMatch?.endsWith?.('+prefer')) {
            return this.downloadMatching(api, lookupResult, requirement.versionMatch,
              referenceTag, wasCanceled, campaign, fileName);
          } else {
            return Bluebird.reject(err);
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

    if (extra.patches !== undefined) {
      attributes['patches'] = extra.patches;
    }

    if (extra.fileList !== undefined) {
      attributes['fileList'] = extra.fileList;
    }

    // if (extra.installerChoices !== undefined) {
      // This actually masks a long standing bug and can barely be considered a fix.
      //  Consider the following case:
      //  1. User1 creates a fomod with a specific structure and uploads it to the site.
      //  2. Curator uploads a collection and adds the fomod.
      //  3. User2 downloads the collection - everything works fine.
      //  4. User1 changes the fomod structure significantly (i.e. some installer steps become optional or removed entirely) and uploads his update to the site.
      //  5. Curator downloads the update and uploads a new revision of his collection. Due to memoization functionality in the collections extension, the same fomod options as in the
      //     first version of the mod are uploaded as part of the collection instead of the newer generated options.
      //  6. User2 updates to the new revision of the collection, the install manager attempts to install the mod but will only generate instructions based on
      //     the new fomod's structure, ommitting installer options that are not present in the new fomod.
      //  7. User2 now has a correct installation of the mod which should work fine depending on the new fomod structure, but our installer option comparisons will fail
      //     making it impossible for the collection to be considered fully installed/complete.
      // attributes['installerChoices'] = extra.installerChoices;
    //}

    api.store.dispatch(setModAttributes(gameId, modId, attributes));
  }

  private dropUnfulfilled(api: IExtensionApi, dep: IDependency,
                          gameId: string, sourceModId: string,
                          recommended: boolean) {
    log('info', 'ignoring unfulfillable rule', { gameId, sourceModId, dep });
    if (recommended) {
      // not ignoring recommended dependencies because what would be the point?
      return;
    }
    const refName = renderModReference(dep.reference, undefined);
    api.store.dispatch(addModRule(gameId, sourceModId, {
      type: recommended ? 'recommends' : 'requires',
      ..._.pick(dep, ['reference', 'extra', 'fileList', 'installerChoices']),
      ignored: true,
    }));
    api.sendNotification({
      type: 'warning',
      title: 'Unfulfillable rule dropped',
      group: 'unfulfillable-rule-dropped',
      message: refName,
      actions: [
        {
          title: 'More', action: () => {
            const sourceMod = api.getState().persistent.mods[gameId]?.[sourceModId];
            api.showDialog('info', 'Unfulfillable rule disabled', {
              text: 'The mod "{{modName}}" has a dependency on "{{refName}}" which '
                + 'Vortex is not able to fulfill automatically.\n\n'
                + 'Very likely Vortex would also not recognize the rule as '
                + 'fulfilled even if you did install it manually. Therefore the rule '
                + 'has been disabled.\n\n'
                + 'Please consult the mod instructions on if and how to solve this dependency.',
              parameters: {
                modName: modName(sourceMod),
                refName,
              },
            }, [
              { label: 'Close' },
            ])
          }
        },
      ],
    });
  }

  private doInstallDependenciesPhase(api: IExtensionApi,
                                     dependencies: IDependency[],
                                     gameId: string,
                                     sourceModId: string,
                                     recommended: boolean,
                                     downloadAndInstall: (dep: IDependency) => Bluebird<string>,
                                     abort: AbortController)
                                     : Bluebird<IDependency[]> {
    const res: Bluebird<IDependency[]> = Bluebird.map(dependencies, (dep: IDependency) => {
      if (abort.signal.aborted) {
        return Bluebird.reject(new UserCanceled());
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
              setModAttribute(gameId, modId, 'installedAsDependency', true));
          }

          // enable the mod in any profile that has the source mod enabled
          const profiles = Object.values(api.getState().persistent.profiles)
            .filter(prof => (prof.gameId === gameId)
                         && prof.modState?.[sourceModId]?.enabled);
          profiles.forEach(prof => {
            api.store.dispatch(setModEnabled(prof.id, modId, true));
          });

          this.applyExtraFromRule(api, gameId, modId, {
            ...dep.extra,
            fileList: dep.fileList ?? dep.extra?.fileList,
            installerChoices: dep.installerChoices,
            patches: dep.patches ?? dep.extra?.patches, });

          const mods = api.store.getState().persistent.mods[gameId];
          return { ...dep, mod: mods[modId] };
        })
        .catch(err => {
          if (dep.extra?.onlyIfFulfillable) {
            this.dropUnfulfilled(api, dep, gameId, sourceModId, recommended);
            return Bluebird.resolve(undefined);
          } else {
            return Bluebird.reject(err);
          }
        })
        // don't cancel the whole process if one dependency fails to install
        .catch(ProcessCanceled, err => {
          if ((err.extraInfo !== undefined) && err.extraInfo.alreadyReported) {
            return Bluebird.resolve(undefined);
          }
          const refName = renderModReference(dep.reference, undefined);
          api.showErrorNotification('Failed to install dependency',
            '{{errorMessage}}\nA common cause for issues here is that the file may no longer '
            + 'be available. You may want to install a current version of the specified mod '
            + 'and update or remove the dependency for the old one.', {
            allowReport: false,
            id: `failed-install-dependency-${refName}`,
            message: refName,
            replace: {
              errorMessage: err.message,
            },
          });
          return Bluebird.resolve(undefined);
        })
        .catch(DownloadIsHTML, () => {
          const refName = renderModReference(dep.reference, undefined);
          api.showErrorNotification('Failed to install dependency',
            'The direct download URL for this file is not valid or didn\'t lead to a file. '
            + 'This may be a setup error in the dependency or the file has been moved.', {
              allowReport: false,
              id: `failed-install-dependency-${refName}`,
              message: refName,
            });
          return Bluebird.resolve(undefined);
        })
        .catch(NotFound, err => {
          const refName = renderModReference(dep.reference, undefined);
          api.showErrorNotification('Failed to install dependency', err, {
            id: `failed-install-dependency-${refName}`,
            message: refName,
            allowReport: false,
          });
          return Bluebird.resolve(undefined);
        })
        .catch(err => {
          const refName = (dep.reference !== undefined)
            ? renderModReference(dep.reference, undefined)
            : 'undefined';
          const notiId = `failed-install-dependency-${refName}`;
          if (err instanceof UserCanceled) {
            if (err.skipped) {
              return Bluebird.resolve();
            } else {
              abort.abort();
              return Bluebird.reject(err);
            }
          } else if (err.code === 'Z_BUF_ERROR') {
            api.showErrorNotification(
              'Download failed',
              'The download ended prematurely or was corrupted. You\'ll have to restart it.', {
                allowReport: false,
              }
            );
          } else if ([403, 404, 410].includes(err['statusCode'])) {
            api.showErrorNotification(
              'Failed to install dependency',
              `${err['message']}\n\nThis error is usually caused by an invalid request, maybe you followed a link that has expired or you lack permission to access it.`,
              {
                allowReport: false,
                id: notiId,
                message: refName,
              });

            return Bluebird.resolve();
          } else if (err.code === 'ERR_INVALID_PROTOCOL') {
            const msg = err.message.replace(/ Expected .*/, '');
            api.showErrorNotification(
              'Failed to install dependency',
              'The URL protocol used in the dependency is not supported, '
              + 'you may be missing an extension required to handle it:\n{{errorMessage}}', {
              message: refName,
              id: notiId,
              allowReport: false,
              replace: {
                errorMessage: msg,
              },
            });
          } else if (err.name === 'HTTPError') {
            err['attachLogOnReport'] = true;
            api.showErrorNotification('Failed to install dependency', err, {
              id: notiId,
            });
          } else {
            const pretty = prettifyNodeErrorMessage(err);
            const newErr = new Error(pretty.message);
            newErr.stack = err.stack;
            newErr['attachLogOnReport'] = true;
            api.showErrorNotification('Failed to install dependency', newErr, {
              message: refName,
              id: notiId,
              allowReport: pretty.allowReport,
              replace: pretty.replace,
            });
          }
          return Bluebird.resolve(undefined);
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
        return Bluebird.resolve([]);
      })
      .catch(UserCanceled, () => {
        log('info', 'canceled out of dependency install');
        api.sendNotification({
          id: 'dependency-installation-canceled',
          type: 'info',
          message: 'Installation of dependencies canceled',
        });
        return Bluebird.resolve([]);
      })
      .catch(err => {
        api.showErrorNotification('Failed to install dependencies', err);
        return Bluebird.resolve([]);
      })
      .filter(dep => dep !== undefined);

    return Bluebird.resolve(res);
  }

  private doInstallDependencies(api: IExtensionApi,
                                gameId: string,
                                sourceModId: string,
                                dependencies: IDependency[],
                                recommended: boolean,
                                silent: boolean): Bluebird<IDependency[]> {
    const state: IState = api.getState();
    let downloads: { [id: string]: IDownload } = state.persistent.downloads.files;

    const sourceMod = state.persistent.mods[gameId][sourceModId];
    const stagingPath = installPathForGame(state, gameId);

    if (sourceMod?.installationPath === undefined) {
      return Bluebird.resolve([]);
    }

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

    const queueDownload = (dep: IDependency): Bluebird<string> => {
      return Bluebird.resolve(this.mDependencyDownloadsLimit.do<string>(() => {
        if (dep.reference.tag !== undefined) {
          queuedDownloads.push(dep.reference);
        }
        return abort.signal.aborted
          ? Bluebird.reject(new UserCanceled(false))
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
              })
              .catch(err => {
                const idx = queuedDownloads.indexOf(dep.reference);
                queuedDownloads.splice(idx, 1);
                return Bluebird.reject(err);
              });
          }));
    };

    const resumeDownload = (dep: IDependency): Bluebird<string> => {
      return Bluebird.resolve(this.mDependencyDownloadsLimit.do<string>(() =>
        abort.signal.aborted
          ? Bluebird.reject(new UserCanceled(false))
          : new Bluebird((resolve, reject) => {
            api.events.emit('resume-download',
              dep.download,
              (err) => err !== null ? reject(err) : resolve(dep.download),
              { allowOpenHTML: false });
          })));
    };

    const installDownload = (dep: IDependency, downloadId: string) : Bluebird<string> => {
      return new Bluebird<string>((resolve, reject) => {
        return this.mDependencyInstallsLimit.do(async () => {
          return abort.signal.aborted
            ? reject(new UserCanceled(false))
            : this.withInstructions(api,
                                modName(sourceMod),
                                renderModReference(dep.reference),
                                dep.reference?.tag ?? downloadId,
                                dep.extra?.['instructions'],
                                recommended, () =>
            this.installModAsync(dep.reference, api, downloadId,
              { choices: dep.installerChoices, patches: dep.patches }, dep.fileList,
              gameId, silent)).then(res => resolve(res))
            .catch(err => {
              if (err instanceof UserCanceled) {
                err.skipped = true;
              }
              return reject(err);
            });
        })
      });
    };

    const doDownload = (dep: IDependency) => {
      let dlPromise = Bluebird.resolve(dep.download);

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
            .catch(err => new Bluebird((resolve, reject) => {
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
            ? Bluebird.reject(new ProcessCanceled('Failed to determine download url'))
            : queueDownload(dep);
        }
      } else if (dep.download === null) {
        dlPromise = Bluebird.reject(new ProcessCanceled('Failed to determine download url'));
      } else if (downloads[dep.download].state === 'paused') {
        dlPromise = resumeDownload(dep);
      }
      return dlPromise
        .catch(AlreadyDownloaded, err => {
          if (err.downloadId !== undefined) {
            return Bluebird.resolve(err.downloadId);
          } else {
            const downloadId = Object.keys(downloads)
              .find(dlId => downloads[dlId].localPath === err.fileName);
            if (downloadId !== undefined) {
              return Bluebird.resolve(downloadId);
            }
          }
          return Bluebird.reject(new NotFound(`download for ${renderModReference(dep.reference)}`));
        })
        .then((downloadId: string) => {
          if ((downloadId !== undefined) && (downloads[downloadId]?.state === 'paused')) {
            return resumeDownload(dep);
          } else {
            return Bluebird.resolve(downloadId);
          }
        })
        .then((downloadId: string) => {
          downloads = api.getState().persistent.downloads.files;

          if ((downloadId === undefined) || (downloads[downloadId] === undefined)) {
            return Bluebird.reject(
              new NotFound(`download for ${renderModReference(dep.reference)}`));
          }
          if (downloads[downloadId].state !== 'finished') {
            // download not actually finished, may be paused
            return Bluebird.reject(new UserCanceled(true));
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
              fileList: dep.fileList,
              patches: dep.patches,
              installerChoices: dep.installerChoices,
              tag: downloads[downloadId].modInfo.referenceTag,
            }, recommended)?.reference;

            dep.mod = findModByRef(dep.reference, api.getState().persistent.mods[gameId]);
          } else {
            log('info', 'downloaded as dependency', { downloadId });
          }

          let queryWrongMD5 = () => Bluebird.resolve();
          if ((dep.mod === undefined)
              && (dep.reference?.versionMatch !== undefined)
              && !isFuzzyVersion(dep.reference.versionMatch)
              && (dep.lookupResults.length > 0)
              && (dep.lookupResults.find(res => res.value.fileMD5 !== undefined) !== undefined)
              && (dep.lookupResults.find(res => res.value.fileMD5 === downloads[downloadId].fileMD5)) === undefined) {
            log('info', 'mismatch md5', {
              expected: dep.lookupResults[0].value.fileMD5,
              got: downloads[downloadId].fileMD5,
            });
            queryWrongMD5 = () => api.showDialog('question', 'Unrecognized file {{reference}}', {
              text: 'The file "{{fileName}}" that was just downloaded for dependency "{{reference}}" '
                  + 'is not the exact file expected. This might not be an issue if the mod has been '
                  + 'updated or repackaged by the author.\n'
                  + 'If you selected this file yourself and you think you may have chosen the wrong one, '
                  + 'please click "Retry". '
                  + 'Otherwise, please continue and keep an eye open for error messages regarding this mod.',
              parameters: {
                fileName: downloads[downloadId].localPath,
                reference: renderModReference(dep.reference, dep.mod),
              },
            }, [
              { label: 'Retry' },
              { label: 'Use file anyway' },
            ])
            .then(result => (result.action === 'Retry')
              ? Bluebird.reject(new ProcessCanceled('retry invalid download'))
              : Bluebird.resolve());
          }

          return (dep.mod === undefined)
            ? queryWrongMD5()
                .then(() => api.getState().settings.downloads.collectionsInstallWhileDownloading ? installDownload(dep, downloadId) : Bluebird.resolve(null))
                .catch(err => {
                  if (dep['reresolveDownloadHint'] === undefined) {
                    return Bluebird.reject(err);
                  }
                  const newState = api.getState();
                  const download = newState.persistent.downloads.files[downloadId];

                  let removeProm = Bluebird.resolve();
                  if (download !== undefined) {
                    const fullPath: string =
                    path.join(downloadPathForGame(newState, download.game[0]), download.localPath);
                    removeProm = fs.removeAsync(fullPath);
                  }

                  return removeProm
                    .then(() => dep['reresolveDownloadHint']())
                    .then(() => doDownload(dep));
                })
            : Bluebird.resolve(dep.mod.id);
        });
    };

    const phases: { [phase: number]: IDependency[] } = {};

    dependencies.forEach(dep => setdefault(phases, dep.phase ?? 0, []).push(dep));

    const abort = new AbortController();

    abort.signal.onabort = () => clearQueued();

    const phaseList = Object.values(phases);

    const findDownloadId = (dep: IDependency) => {
      return Object.keys(downloads).find(dlId => downloads[dlId].modInfo?.referenceTag === dep.reference.tag);
    }
    const res: Bluebird<IDependency[]> = Bluebird.reduce(phaseList,
      (prev: IDependency[], depList: IDependency[], idx: number) => {
        if (depList.length === 0) {
          return prev;
        }
        return this.doInstallDependenciesPhase(api, depList, gameId, sourceModId,
                                               recommended,
                                               doDownload, abort)
          .then(async (updated: IDependency[]) => api.getState().settings.downloads.collectionsInstallWhileDownloading
            ? Promise.resolve(updated)
            : new Promise<IDependency[]>(async (resolve, reject) => {
              const sorted = ([...updated]).sort((a, b) => (a.reference.fileSize ?? 0) - (b.reference.fileSize ?? 0));
              try {
                // Give the state a chance to catch up
                await Promise.all(sorted.map(dep => installDownload(dep, findDownloadId(dep))));
                return resolve(updated);
              } catch (err) {
                return reject(err);
              }
          }))
          .then((updated: IDependency[]) => {
            if (idx === phaseList.length - 1) {
              return Bluebird.resolve(updated);
            }
            return toPromise(cb => api.events.emit('deploy-mods', cb))
              .then(() => updated);
          })
          .then((updated: IDependency[]) => [].concat(prev, updated));
    }, []);

    this.mDependencyInstalls[sourceModId] = () => {
      abort.abort();
    };

    return Bluebird.resolve(res);
  }

  private updateModRule(api: IExtensionApi, gameId: string, sourceModId: string,
                        dep: IDependency, reference: IModReference, recommended: boolean) {
    const state: IState = api.store.getState();
    const rules: IModRule[] =
      getSafe(state.persistent.mods, [gameId, sourceModId, 'rules'], []);
    const oldRule = rules.find(iter => referenceEqual(iter.reference, dep.reference));

    if (oldRule === undefined) {
      return undefined;
    }

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
                      dependencies: IDependency[], recommended: boolean): Bluebird<void> {
    dependencies.forEach(dep => {
      const updatedRef: IModReference = { ...dep.reference };
      updatedRef.idHint = dep.mod?.id;
      updatedRef.installerChoices = dep.installerChoices;
      updatedRef.patches = dep.patches;
      updatedRef.fileList = dep.fileList;
      this.updateModRule(api, gameId, sourceModId, dep, updatedRef, recommended);
    });
    return Bluebird.resolve();
  }

  private doInstallDependencyList(api: IExtensionApi,
                                  profile: IProfile,
                                  gameId: string,
                                  modId: string,
                                  name: string,
                                  dependencies: IDependency[],
                                  silent: boolean) {
    if (dependencies.length === 0) {
      return Bluebird.resolve();
    }

    interface IDependencySplit {
      success: IDependency[];
      existing: IDependency[];
      error: IDependencyError[];
    }

    // get updated mod state
    const modState = (profile !== undefined)
      ? (api.getState().persistent.profiles[profile.id]?.modState ?? {})
      : {};

    const mods = api.getState().persistent.mods?.[gameId] ?? {};

    const { success, existing, error } = dependencies.reduce(
      (prev: IDependencySplit, dep: Dependency) => {
        if (dep['error'] !== undefined) {
          prev.error.push(dep as IDependencyError);
        } else {
          const { mod, reference } = dep as IDependency;
          const modReference: IModReference = { ...(dep as IDependency), ...reference };
          if ((mod === undefined) || !(modState[mod.id]?.enabled ?? false) || (!!mods[mod.id] && testModReference(mods[mod.id], modReference) !== true)) {
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
      return this.doInstallDependencies(api, gameId, modId, success, false, silent)
        .then(updated => this.updateRules(api, gameId, modId, [].concat(existing, updated), false));
    }

    if (success.length === 0) {
      return Bluebird.resolve();
    }

    const context = getBatchContext('install-dependencies', '', true);

    return this.showMemoDialog(api, context, name, success, error)
      .then(result => {
        if (result.action === 'Install') {
          return this.doInstallDependencies(api, gameId, modId, success, false, silent)
            .then(updated => this.updateRules(api, gameId, modId,
              [].concat(existing, updated), false));
        } else {
          return Bluebird.resolve();
        }
      });
  }

  private showMemoDialog(api: IExtensionApi,
                         context: IBatchContext,
                         name: string,
                         success: IDependency[],
                         error: IDependencyError[]): Bluebird<IDialogResult> {
    const remember = context.get<boolean>('remember', null);

    if (truthy(remember)) {
      return Bluebird.resolve<IDialogResult>({
        action: remember ? 'Install' : 'Don\'t Install',
        input: {},
      });
    } else {
      const downloads = api.getState().persistent.downloads.files;

      const t = api.translate;

      const requiredInstalls = success.filter(dep => dep.mod === undefined);
      const requiredDownloads = requiredInstalls.filter(dep =>
        (dep.download === undefined) || [undefined, 'paused'].includes(downloads[dep.download]?.state));
      const requireEnableOnly = success.filter(dep => dep.mod !== undefined);

      let bbcode = '';

      let list: string = '';
      if (requiredDownloads.length > 0) {
        list += `[h4]${t('Require Download & Install')}[/h4]<br/>[list]`
          + requiredDownloads.map(mod => '[*]' + renderModReference(mod.reference)).join('\n')
          + '[/list]<br/>';
      }
      const requireInstallOnly = requiredInstalls
        .filter(mod => !requiredDownloads.includes(mod));
      if (requireInstallOnly.length > 0) {
        list += `[h4]${t('Require Install')}[/h4]<br/>[list]`
          + requireInstallOnly
            .map(mod => '[*]' + renderModReference(mod.reference)).join('\n')
          + '[/list]<br/>';
      }
      if (requireEnableOnly.length > 0) {
        list += `[h4]${t('Will be enabled')}[/h4]<br/>[list]`
          + requireEnableOnly.map(mod => '[*]' + modName(mod.mod)).join('\n')
          + '[/list]';
      }

      if (success.length > 0) {
        bbcode += t('{{modName}} requires the following dependencies:', {
          replace: { modName: name },
        });
      }

      if (error.length > 0) {
        bbcode += '[color=red]'
          + t('{{modName}} has unsolved dependencies that could not be found automatically. ',
              { replace: { modName: name } })
          + t('Please install them manually') + ':<br/>'
          + '{{errors}}'
          + '[/color]';
      }

      if (list.length > 0) {
        bbcode += '<br/>' + list;
      }

      const actions = success.length > 0
        ? [
          { label: 'Don\'t install' },
          { label: 'Install' },
        ]
        : [{ label: 'Close' }];


      return api.store.dispatch(
        showDialog('question', t('Install Dependencies'), {
          bbcode,
          parameters: {
            modName: name,
            count: success.length,
            instCount: requiredInstalls.length,
            dlCount: requiredDownloads.length,
            errors: error.map(err => err.error).join('<br/>'),
          },
          checkboxes: [
            { id: 'remember', text: 'Do this for all dependencies', value: false },
          ],
          options: {
            translated: true,
          },
        }, actions))
        .then(result => {
          if (result.input['remember']) {
            context.set('remember', result.action === 'Install');
          }
          return result;
        });
    }
  }

  private installDependenciesImpl(api: IExtensionApi,
                                  profile: IProfile,
                                  gameId: string,
                                  modId: string,
                                  name: string,
                                  rules: IModRule[],
                                  installPath: string,
                                  silent: boolean)
                                  : Bluebird<void> {
    return this.mDependencyQueue(() => {
      const filteredRules = (rules ?? []).filter(
        (rule: IModRule) => ['recommends', 'requires'].includes(rule.type)
          && !rule.ignored);

      if (filteredRules.length === 0) {
        api.events.emit('did-install-dependencies', gameId, modId, false);
        return Bluebird.resolve();
      }

      const notificationId = `${installPath}_activity`;

      let canceled = false;
      api.events.emit('will-install-dependencies', gameId, modId, false, () => { canceled = true; });
      if (canceled) {
        return Bluebird.resolve();
      }

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
          if (!(err instanceof UserCanceled)) {
            api.showErrorNotification('Failed to check dependencies', err);
          }
        })
        .finally(() => {
          log('debug', 'done installing dependencies', { gameId, modId });
          api.events.emit('did-install-dependencies', gameId, modId, false);
        });
    }, false);
  }

  private installRecommendationsQueryMain(
    api: IExtensionApi, modName: string,
    success: IDependency[], error: IDependencyError[],
    remember: boolean | null)
    : Bluebird<IDialogResult> {
    if (remember === true) {
      return Bluebird.resolve({ action: 'Install All', input: {} });
    } else if (remember === false) {
      return Bluebird.resolve({ action: 'Skip', input: {} });
    }
    let bbcode: string = '';
    if (success.length > 0) {
      bbcode += '{{modName}} recommends the installation of additional mods. '
        + 'Please use the checkboxes below to select which to install.<br/><br/>[list]';
      for (const item of success) {
        bbcode += `[*] ${renderModReference(item.reference, undefined)}`;
      }

      bbcode += '[/list]';
    }

    if (error.length > 0) {
      bbcode += '[color=red]'
        + '{{modName}} has unsolved dependencies that could not be found automatically. '
        + 'Please install them manually.'
        + '[/color][list]';
      for (const item of error) {
        bbcode += `[*] ${item.error}`;
      }
      bbcode += '[/list]';
    }

    return api.store.dispatch(
      showDialog('question', 'Install Recommendations', {
        bbcode,
        checkboxes: [
          { id: 'remember', text: 'Do this for all recommendations', value: false },
        ],
        parameters: {
          modName,
        },
      }, [
        { label: 'Skip' },
        { label: 'Manually Select' },
        { label: 'Install All' },
      ]));
  }

  private installRecommendationsQuerySelect(
    api: IExtensionApi, modName: string, success: IDependency[])
    : Bluebird<IDialogResult> {
    let bbcode: string = '';
    if (success.length > 0) {
      bbcode += '{{modName}} recommends the installation of additional mods. '
        + 'Please use the checkboxes below to select which to install.<br/><br/>';
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

    return api.store.dispatch(
      showDialog('question', 'Install Recommendations', {
        bbcode,
        checkboxes,
        parameters: {
          modName,
        },
      }, [
        { label: 'Don\'t install' },
        { label: 'Continue' },
      ]));
  }

  private installRecommendationsImpl(api: IExtensionApi,
                                     profile: IProfile,
                                     gameId: string,
                                     modId: string,
                                     name: string,
                                     rules: IRule[],
                                     installPath: string,
                                     silent: boolean)
                                     : Bluebird<void> {
    return this.mDependencyQueue(() => {
      // TODO a lot of code duplication with installDependenciesImpl
      const filteredRules = (rules ?? []).filter(
        (rule: IModRule) => ['recommends', 'requires'].includes(rule.type)
          && !rule.ignored);

      if (filteredRules.length === 0) {
        return Bluebird.resolve();
      }

      const notificationId = `${installPath}_activity`;

      let canceled = false;
      api.events.emit('will-install-dependencies', gameId, modId, true, () => { canceled = true; });
      if (canceled) {
        return Bluebird.resolve();
      }

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
            return Bluebird.resolve();
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

          // all recommendations already installed
          if ((success.length === 0) && (error.length === 0)) {
            return Bluebird.resolve();
          }

          const state: IState = api.store.getState();
          const downloads = state.persistent.downloads.files;

          const context = getBatchContext('install-recommendations', '', true);
          context.set<number>('num-instructions',
            success.filter(succ => succ.extra?.['instructions'] !== undefined).length);
          const remember = context.get<boolean>('remember', null);
          let queryProm: Bluebird<IDependency[]> = Bluebird.resolve(success);

          if (!silent || (error.length > 0)) {
            queryProm = this.installRecommendationsQueryMain(api, name, success, error, remember)
            .then(result => {
              if (result.action === 'Skip') {
                if (result.input?.remember) {
                  context.set('remember', false);
                }
                return [];
              } else if (result.action === 'Install All') {
                if (result.input?.remember) {
                  context.set('remember', true);
                }
                return success;
              } else {
                return this.installRecommendationsQuerySelect(api, name, success)
                  .then(selectResult => {
                    if (selectResult.action === 'Continue') {
                      return Object.keys(selectResult.input)
                        .filter(key => selectResult.input[key])
                        .map(key => success[parseInt(key, 10)]);
                    } else {
                      return [];
                    }
                  })
              }
            });
          }

          return queryProm.then(result => {
            return this.doInstallDependencies(
              api,
              gameId,
              modId,
              result,
              true, silent)
              .then(updated => this.updateRules(api, gameId, modId,
                [].concat(existing, updated), true));
          });
        })
        .catch((err) => {
          api.store.dispatch(stopActivity('dependencies', 'gathering'));
          if (!(err instanceof UserCanceled)) {
            api.showErrorNotification('Failed to check dependencies', err);
          }
        })
        .finally(() => {
          api.dismissNotification(notificationId);
          api.events.emit('did-install-dependencies', gameId, modId, true);
        });
    }, false);
  }

  private withInstructions<T>(api: IExtensionApi,
                              sourceName: string,
                              title: string,
                              id: string,
                              instructions: string,
                              recommendations: boolean,
                              cb: () => Bluebird<T>)
                              : Bluebird<T> {
    if (!truthy(instructions)) {
      return cb();
    }

    if (recommendations) {
      return Bluebird.resolve((async () => {
          const context = getBatchContext('install-recommendations', '');
          let action = context.get<string>('remember-instructions');
          const remaining = context.get<number>('num-instructions') - 1;

          if ((action === null) || (action === undefined)) {
            let checkboxes: ICheckbox[];
            if (remaining > 0) {
              checkboxes = [
                {
                  id: 'remember',
                  value: false,
                  text: 'Do this for all remaining instructions ({{remaining}} more)'
                },
              ];
            }
            const result = await api.showDialog('info', title, {
              md: instructions,
              checkboxes,
              parameters: {
                remaining,
              },
            }, [
              { label: 'Skip' },
              { label: 'Install' },
            ]);

            if (result.input['remember']) {
              context.set('remember-instructions', result.action);
            }
            action = result.action;
          }

          context.set<number>('num-instructions', remaining);

          if (action === 'Install') {
            return cb();
          } else {
            return Bluebird.reject(new UserCanceled(true));
          }
        })());
    } else {
      api.ext.showOverlay?.(`install-instructions-${id}`, title, instructions, undefined, {
        id,
      });

      return cb();
    }
  }

  private installModAsync(requirement: IReference,
                          api: IExtensionApi,
                          downloadId: string,
                          modInfo?: any,
                          fileList?: IFileListItem[],
                          forceGameId?: string,
                          silent?: boolean): Bluebird<string> {
    return new Bluebird<string>((resolve, reject) => {
      const state = api.store.getState();
      const download: IDownload = state.persistent.downloads.files[downloadId];
      if (download === undefined) {
        return reject(new NotFound(renderModReference(requirement)));
      }
      const downloadGame: string[] = getDownloadGames(download);
      const fullPath: string =
        path.join(downloadPathForGame(state, downloadGame[0]), download.localPath);
      this.install(downloadId, fullPath, downloadGame,
        api, { ...modInfo, download }, false, silent, (error, id) => {
          if (error === null) {
            return resolve(id);
          } else {
            return reject(error);
          }
        }, forceGameId, fileList, silent, undefined, false);
    });
  }

  private fixDestination(source: string, destination: string): Bluebird<string> {
    // if the source is an existing file an the destination is an existing directory,
    // copyAsync or renameAsync will not work, they expect the destination to be the
    // name of the output file.
    return fs.statAsync(source)
      .then(sourceStat => sourceStat.isDirectory()
        ? Bluebird.resolve(destination)
        : fs.statAsync(destination)
          .then(destStat => destStat.isDirectory()
            ? path.join(destination, path.basename(source))
            : destination))
      .catch(() => Bluebird.resolve(destination));
  }

  private transferFile(source: string, destination: string, move: boolean): Bluebird<void> {
    return fs.ensureDirAsync(path.dirname(destination))
      .then(() => this.fixDestination(source, destination))
      .then(fixedDest => move
        ? fs.renameAsync(source, fixedDest)
          .catch(err => (['EXDEV', 'EEXIST'].includes(err.code))
            ? fs.copyAsync(source, fixedDest, { noSelfCopy: true })
            : Bluebird.reject(err))
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
    gameId: string): Bluebird<void> {
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
          return Bluebird.mapSeries(Object.keys(sourceMap), srcRel => {
            const sourcePath = path.join(tempPath, srcRel);
            // need to do this sequentially, otherwise we can't use the idx to
            // decide between rename and copy
            return Bluebird.mapSeries(sourceMap[srcRel], (dest, idx, len) => {
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
                    : Bluebird.reject(err))
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
                    return Bluebird.resolve();
                  }
                })
                .catch(err => {
                  if (err.code === 'ENOENT') {
                    missingFiles.push(srcRel);
                  } else if (err.code === 'EPERM') {
                    return this.transferFile(sourcePath, destPath, false);
                  } else {
                    return Bluebird.reject(err);
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
