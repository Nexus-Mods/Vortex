import { showDialog } from '../../actions/notifications';
import { IDialogResult } from '../../types/IDialog';
import { IExtensionApi } from '../../types/IExtensionContext';
import { createErrorReport } from '../../util/errorHandling';
import getNormalizeFunc, { Normalize } from '../../util/getNormalizeFunc';
import { log } from '../../util/log';
import { activeGameId, activeProfile, downloadPath, gameName } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { setdefault } from '../../util/util';

import { IDownload } from '../download_management/types/IDownload';
import modName from '../mod_management/util/modName';
import { setModEnabled } from '../profile_management/actions/profiles';

import { IDependency } from './types/IDependency';
import { IInstall } from './types/IInstall';
import { IMod } from './types/IMod';
import { IModInstaller } from './types/IModInstaller';
import { ISupportedResult, ITestSupported } from './types/ITestSupported';
import gatherDependencies from './util/dependencies';
import filterModInfo from './util/filterModInfo';

import InstallContext from './InstallContext';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import { IHashResult, ILookupResult, IReference, IRule } from 'modmeta-db';
import ZipT = require('node-7z');
import * as path from 'path';
import * as rimraf from 'rimraf';
import { dir as tmpDir, file as tmpFile } from 'tmp';

// TODO the type declaration for rimraf is actually wrong atm (v0.0.28)
interface IRimrafOptions {
  glob?: { nosort: boolean, silent: boolean } | false;
  disableGlob?: boolean;
  emfileWait?: number;
  maxBusyTries?: number;
}
type rimrafType = (path: string, options: IRimrafOptions, callback: (err?) => void) => void;
const rimrafAsync = Promise.promisify(rimraf as rimrafType);

interface IZipEntry {
  date: Date;
  attr: string;
  size: number;
  name: string;
}

interface ISupportedInstaller {
  installer: IModInstaller;
  requiredFiles: string[];
}

type InstructionType = 'copy' | 'submodule' | 'generatefile' | 'unsupported';

interface IInstruction {
  type: InstructionType;

  path: string;
  source: string;
  destination: string;
}

interface IInstructionGroups {
  copies?: IInstruction[];
  submodule?: IInstruction[];
  unsupported?: IInstruction[];
}

// tslint:disable-next-line:no-empty
function UserCanceled() { }

/**
 * central class for the installation process
 * 
 * @class InstallManager
 */
class InstallManager {
  private mInstallers: IModInstaller[] = [];
  private mGetInstallPath: () => string;
  private mTask: ZipT;

  constructor(installPath: () => string) {
    this.mGetInstallPath = installPath;
  }

  /**
   * add an installer extension
   * 
   * @param {number} priority priority of the installer. the lower the number the higher
   *                          the priority, so at priority 0 the extension would always be
   *                          the first to be queried
   * @param {ITestSupported} testSupported
   * @param {IInstall} install
   * 
   * @memberOf InstallManager
   */
  public addInstaller(
    priority: number,
    testSupported: ITestSupported,
    install: IInstall) {
    this.mInstallers.push({ priority, testSupported, install });
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
   * 
   * TODO return a promise instead of callback
   * TODO the callback isn't called if the installation is canceled by the user
   */
  public install(
    archiveId: string,
    archivePath: string,
    downloadGameId: string,
    api: IExtensionApi,
    info: any,
    processDependencies: boolean,
    enable: boolean,
    callback?: (error: Error, id: string) => void) {
    if (this.mTask === undefined) {
      const Zip: typeof ZipT = require('node-7z');
      this.mTask = new Zip();
    }

    let fullInfo = Object.assign({}, info);
    let destinationPath: string;

    const baseName = path.basename(archivePath, path.extname(archivePath));
    const currentProfile = activeProfile(api.store.getState());
    let modId = baseName;
    let installGameId;
    let installContext;

    let filteredInfo;

    this.queryGameId(api.store, downloadGameId)
        .then(gameId => {
          installGameId = gameId;
          installContext = new InstallContext(gameId, api.store.dispatch);
          installContext.startIndicator(baseName);

          return api.lookupModMeta({filePath: archivePath});
        })
        .then((modInfo: ILookupResult[]) => {
          if (modInfo.length > 0) {
            fullInfo.meta = modInfo[0].value;
          }

          modId = this.deriveInstallName(baseName, fullInfo);
          // if the name is already taken, consult the user,
          // repeat until user canceled, decided to replace the existing
          // mod or provided a new, unused name
          const checkNameLoop = () => {
            return this.checkModExists(modId, api, installGameId) ?
                       this.queryUserReplace(modId, api)
                           .then((choice: { name: string, enable: boolean }) => {
                             modId = choice.name;
                             if (choice.enable) {
                               enable = true;
                             }
                             return checkNameLoop();
                           }) :
                       Promise.resolve(modId);
          };

          return checkNameLoop();
        })
        .then(() => {
          filteredInfo = filterModInfo(fullInfo);

          // TODO this relies entirely on the file id
          const oldMod =
              (filteredInfo.fileId !== undefined) ?
                  this.findPreviousVersionMod(filteredInfo.fileId, api.store,
                                              installGameId) :
                  undefined;

          if (oldMod !== undefined) {
            const wasEnabled = getSafe(currentProfile.modState, [oldMod.id, 'enabled'], false);
            return this.userVersionChoice(oldMod, api.store)
                .then((action: string) => {
                  if (action === 'Install') {
                    enable = enable || wasEnabled;
                    return null;
                  } else if (action === 'Replace') {
                    // we need to remove the old mod before continuing. This ensures
                    // the mod is deactivated and undeployed (as to not leave dangling
                    // links) and it ensures we do a clean install of the mod
                    return new Promise((resolve, reject) => {
                      api.events.emit('remove-mod', oldMod.id, (error: Error) => {
                        if (error !== null) {
                          return Promise.reject(error);
                        } else {
                          // use the same mod id as the old version so that all profiles
                          // keep using it.
                          modId = oldMod.id;
                          enable = enable || wasEnabled;
                          return Promise.resolve();
                        }
                      });
                    });
                  }
                });
          } else {
            return null;
          }
        })
        .then(() => {
          installContext.startInstallCB(modId, archiveId);

          destinationPath = path.join(this.mGetInstallPath(), modId);
          return this.installInner(archivePath, installGameId);
        })
        .then((result) => {
          installContext.setInstallPathCB(modId, destinationPath);
          return this.processInstructions(api, archivePath, destinationPath,
                                          installGameId, result);
        })
        .then(() => {
          installContext.finishInstallCB('success', filteredInfo);
          if (enable) {
            api.store.dispatch(setModEnabled(currentProfile.id, modId, true));
          }
          if (processDependencies) {
            this.installDependencies(filteredInfo.rules, this.mGetInstallPath(),
                                     installContext, api);
          }
          if (callback !== undefined) {
            callback(null, modId);
          }
        })
        .catch((err) => {
          let canceled = err instanceof UserCanceled;
          let prom =
              destinationPath !== undefined ?
                  rimrafAsync(destinationPath, {glob: false, maxBusyTries: 1})
                      .then(() => undefined) :
                  Promise.resolve();
          prom.then(() => installContext.finishInstallCB(canceled ? 'canceled' :
                                                                    'failed'));

          if (err === undefined) {
            return undefined;
          } else if (canceled) {
            return undefined;
          } else {
            const { genHash } = require('modmeta-db');
            let errMessage = typeof err === 'string' ? err : err.message + '\n' + err.stack;

            return genHash(archivePath)
                .then((hashResult: IHashResult) => {
                  let id =
                      `${path.basename(archivePath)} (md5: ${hashResult.md5sum})`;
                  installContext.reportError(
                      'Installation failed',
                      `The installer ${id} failed: ${errMessage}`);
                  if (callback !== undefined) {
                    callback(err, modId);
                  }
                });
          }
        })
        .finally(() => { installContext.stopIndicator(); });
  }

  /**
   * find the right installer for the specified archive, then install
   */
  private installInner(archivePath: string, gameId: string) {
    let fileList: IZipEntry[] = [];
    // get list of files in the archive
    return this.mTask.list(archivePath, {},
                           (files: any[]) => {
                             fileList.push(...files.filter(
                                 (spec) => spec.attr[0] !== 'D'));
                           })
        .catch(err => {
          return Promise.reject(err);
        })
        .then(() => this.getInstaller(
                  fileList.map((entry: IZipEntry) => entry.name)))
        .then((supportedInstaller: ISupportedInstaller) => {
          if (supportedInstaller === undefined) {
            throw new Error('no installer supporting this file');
          }
          const {installer, requiredFiles} = supportedInstaller;
          let cleanup: () => void;
          let reqFilesPath: string;
          // extract the requested files, then initiate the actual install
          return new Promise<string>((resolve, reject) => {
                   tmpDir({unsafeCleanup: true},
                          (err: any, tmpPath: string,
                           cleanupCallback: () => void) => {
                            if (err !== null) {
                              reject(err);
                            }
                            cleanup = cleanupCallback;
                            resolve(tmpPath);
                          });
                 })
              .then((tmpPath: string) => {
                reqFilesPath = tmpPath;
                if (requiredFiles.length > 0) {
                  return this.extractFileList(archivePath, tmpPath,
                                              requiredFiles);
                } else {
                  return undefined;
                }
              })
              .then(() => installer.install(
                        fileList.map((entry: IZipEntry) => entry.name),
                        reqFilesPath, gameId,
                        (perc: number) => log('info', 'progress', perc)))
              .finally(() => {
                if (cleanup !== undefined) {
                  cleanup();
                }
              });
        });
  }

  private queryGameId(store: Redux.Store<any>,
                      downloadGameId: string): Promise<string> {
    const currentGameId = activeGameId(store.getState());
    return new Promise<string>((resolve, reject) => {
      if (getSafe(store.getState(),
                  ['settings', 'gameMode', 'discovered', downloadGameId],
                  undefined) === undefined) {
        let btnLabel =
            `Install for "${gameName(store.getState(), currentGameId)}"`;
        store.dispatch(showDialog(
            'question', 'Game not installed',
            {
              message:
                  'The game associated with this download is not discovered.',
            },
            {
              Cancel: () => reject(new UserCanceled()),
              [btnLabel]: () => resolve(currentGameId),
            }));
      } else if (currentGameId !== downloadGameId) {
        store.dispatch(showDialog(
            'question', 'Download is for a different game',
            {
              message:
                  'This download is associated with a different game than the current.' +
                      'Which one do you want to install it for?',
            },
            {
              Cancel: () => reject(new UserCanceled()),
              [gameName(store.getState(), currentGameId)]:
                  () => resolve(currentGameId),
              [gameName(store.getState(), downloadGameId)]:
                  () => resolve(downloadGameId),
            }));
      } else {
        resolve(downloadGameId);
      }
    });
  }

  private extractFileList(
    archivePath: string,
    outputPath: string,
    files: string[]): Promise<void> {
    let extractFilePath: string;
    // write the file list to a temporary file, then use that as the
    // input file for 7zip, to avoid quoting problems
    return new Promise<string>((resolve, reject) => {
      tmpFile({ keep: true } as any,
        (err: any, tmpPath: string, fd: number,
          cleanupCB: () => void) => {
          if (err !== null) {
            reject(err);
          } else {
            fs.closeAsync(fd).then(() => resolve(tmpPath));
          }
        });
    })
      .then((tmpPath: string) => {
        extractFilePath = tmpPath;
        const extractList: string[] =
          files.map((filePath: string) => '"' + filePath + '"');
        return fs.writeFileAsync(tmpPath, extractList.join('\n'));
      })
      .then(() => this.mTask.extractFull(
        archivePath, outputPath,
        { raw: [`-ir@${extractFilePath}`], ssc: false }))
      .finally(() => fs.unlinkAsync(extractFilePath))
      .then(() => undefined);
  }

  private processInstructions(
    api: IExtensionApi,
    archivePath: string,
    destinationPath: string,
    gameId: string,
    result: { instructions: IInstruction[] }) {
    if (result.instructions === null) {
      // this is the signal that the installer has already reported what went wrong
      return Promise.reject(null);
    }
    if ((result.instructions === undefined) ||
      (result.instructions.length === 0)) {
      return Promise.reject('installer returned no instructions');
    }

    let instructionGroups: IInstructionGroups = {};

    result.instructions.forEach((instruction) => {
      setdefault(instructionGroups, instruction.type, []).push(instruction);
    });

    const copies = result.instructions.filter(
      (instruction) => instruction.type === 'copy');

    const genfiles = result.instructions.filter(
      (instruction) => instruction.type === 'generatefile');

    const subModule = result.instructions.filter(
      (instruction) => instruction.type === 'submodule');

    if (instructionGroups.unsupported !== undefined) {
      let missing = instructionGroups.unsupported.map((instruction) => instruction.source);
      const { genHash } = require('modmeta-db');
      const makeReport = () =>
        genHash(archivePath)
          .then(
          (hashResult: IHashResult) => createErrorReport(
            'Installer failed',
            {
              message: 'The installer uses unimplemented functions',
              details:
              `Missing instructions: ${missing.join(', ')}\n` +
              `Installer name: ${path.basename(archivePath)}\n` +
              `MD5 checksum: ${hashResult.md5sum}\n`,
            },
            ['installer']));
      const showUnsupportedDialog = () => api.store.dispatch(showDialog(
        'info', 'Installer unsupported',
        {
          message:
          'This installer is (partially) unsupported as it\'s ' +
          'using functionality that hasn\'t been implemented yet. ' +
          'Please help us fix this by submitting an error report with a link to this mod.',
        },
        {
          Report: makeReport,
          Close: null,
        }));

      api.sendNotification({
        type: 'info',
        message: 'Installer unsupported',
        actions: [{ title: 'More', action: showUnsupportedDialog }],
      });
    }

    // process 'copy' instructions during extraction
    return this.extractArchive(archivePath, destinationPath, copies)
      .then(() => Promise.each(genfiles,
        (gen) => {
          let outputPath = path.join(destinationPath, gen.destination);
          return fs.ensureDirAsync(path.dirname(outputPath))
            .then(() => fs.writeFileAsync(outputPath, gen.source));
        })
        // process 'submodule' instructions
        .then(() => Promise.each(
          subModule,
          (mod) => this.installInner(mod.path, gameId)
            .then((resultInner) => this.processInstructions(
              api, mod.path, destinationPath, gameId,
              resultInner)))));
  }

  private checkModExists(installName: string, api: IExtensionApi, gameMode: string): boolean {
    return installName in (api.store.getState().persistent.mods[gameMode] || {});
  }

  private findPreviousVersionMod(fileId: number, store: Redux.Store<any>,
                                 gameMode: string): IMod {
    let mods = store.getState().persistent.mods[gameMode] || {};
    let mod: IMod;
    Object.keys(mods).forEach(key => {
      const newestFileId: number = getSafe(mods[key].attributes, ['newestFileId'], undefined);
      const currentFileId: number = getSafe(mods[key].attributes, ['fileId'], undefined);
      if (newestFileId !== currentFileId && newestFileId === fileId) {
        mod = mods[key];
      }
    });

    return mod;
  }

  private userVersionChoice(oldMod: IMod, store: Redux.Store<any>): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      store.dispatch(showDialog(
          'question', modName(oldMod),
          {
            message:
            'An older version of this mod is already installed.' +
            'You can replace the existing one or install this one alongside it. ' +
            'If you have other profiles they will remain with the old version.',
            formcontrol: [],
          },
          {
            Cancel: null,
            Replace: null,
            Install: null,
          }))
        .then((result: IDialogResult) => {
          if (result.action === 'Cancel') {
            reject(new UserCanceled());
          } else {
            resolve(result.action);
          }
        });
    });
  }

  private queryUserReplace(modId: string, api: IExtensionApi) {
    return new Promise<{ name: string, enable: boolean }>((resolve, reject) => {
      api.store
        .dispatch(showDialog(
          'question', 'Mod exists',
          {
            message:
            'This mod seems to be installed already. You can replace the ' +
            'existing one or install the new one under a different name ' +
            '(this name is used internally, you can still change the display name ' +
            'to anything you want later).',
            formcontrol: [{
              id: 'newName',
              type: 'input',
              value: modId,
              label: 'Name',
            }],
          },
          {
            Cancel: null,
            Replace: null,
            Rename: null,
          }))
        .then((result: IDialogResult) => {
          if (result.action === 'Cancel') {
            reject(new UserCanceled());
          } else if (result.action === 'Rename') {
            resolve({ name: result.input.newName, enable: false });
          } else if (result.action === 'Replace') {
            const currentProfile = activeProfile(api.store.getState());
            const wasEnabled = getSafe(currentProfile.modState, [modId, 'enabled'], false);
            api.events.emit('remove-mod', modId, (err) => {
              if (err !== null) {
                reject(err);
              } else {
                resolve({ name: modId, enable: wasEnabled });
              }
            });
          }
        });
    });
  }

  private getInstaller(
    fileList: string[],
    offsetIn?: number): Promise<ISupportedInstaller> {
    let offset = offsetIn || 0;
    if (offset >= this.mInstallers.length) {
      return Promise.resolve(undefined);
    }
    return this.mInstallers[offset].testSupported(fileList).then(
      (testResult: ISupportedResult) => {
        if (testResult.supported === true) {
          return Promise.resolve({
            installer: this.mInstallers[offset],
            requiredFiles: testResult.requiredFiles,
          });
        } else {
          return this.getInstaller(fileList, offset + 1);
        }
      }).catch((err) => {
        log('warn', 'failed to test installer support', err.message);
        return this.getInstaller(fileList, offset + 1);
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
    return archiveName;
  }

  private downloadModAsync(
    requirement: IReference,
    sourceURI: string,
    api: IExtensionApi): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!api.events.emit('start-download', [sourceURI], {}, false,
        (error, id) => {
          if (error === null) {
            resolve(id);
          } else {
            reject(error);
          }
        })) {
        reject(new Error('download manager not installed?'));
      }
    });
  }

  private doInstallDependencies(
    dependencies: IDependency[],
    api: IExtensionApi): Promise<void> {
    return Promise.all(dependencies.map((dep: IDependency) => {
      if (dep.download === undefined) {
        return this.downloadModAsync(
          dep.reference,
          dep.lookupResults[0].value.sourceURI,
          api)
          .then((downloadId: string) => {
            return this.installModAsync(dep.reference, api,
              downloadId);
          });
      } else {
        return this.installModAsync(dep.reference, api,
          dep.download);
      }
    }))
      .catch((err) => {
        api.showErrorNotification('Failed to install dependencies',
          err.message);
      })
      .then(() => undefined);
  }

  private installDependencies(
    rules: IRule[],
    installPath: string,
    installContext: InstallContext,
    api: IExtensionApi): Promise<void> {
    let notificationId = `${installPath}_activity`;
    api.sendNotification({
      id: notificationId,
      type: 'activity',
      message: 'Checking dependencies',
    });
    return gatherDependencies(rules, api)
      .then((dependencies: IDependency[]) => {
        api.dismissNotification(notificationId);

        if (dependencies.length === 0) {
          return Promise.resolve();
        }

        let requiredDownloads =
          dependencies.reduce((prev: number, current: IDependency) => {
            return prev + (current.download ? 0 : 1);
          }, 0);

        return new Promise<void>((resolve, reject) => {
          let message =
            `This mod has unresolved dependencies. ${dependencies.length} mods have to be
installed, ${requiredDownloads} of them have to be downloaded first.`;

          api.store.dispatch(
            showDialog('question', 'Install Dependencies', { message }, {
              "Don't install": null,
              Install:
              () => this.doInstallDependencies(dependencies, api),
            }));
        });
      })
      .catch((err) => {
        api.dismissNotification(notificationId);
        api.showErrorNotification('Failed to check dependencies', err);
      });
  }

  private installModAsync(
    requirement: IReference,
    api: IExtensionApi,
    downloadId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const state = api.store.getState();
      let download: IDownload = state.persistent.downloads.files[downloadId];
      let fullPath: string = path.join(downloadPath(state), download.localPath);
      this.install(downloadId, fullPath, download.game || activeGameId(state),
        api, download.modInfo, false, false, (error, id) => {
          if (error === null) {
            resolve(id);
          } else {
            reject(error);
          }
        });
    });
  }
  /**
   * extract an archive
   *
   * @export
   * @param {string} archivePath path to the archive file
   * @param {string} destinationPath path to install to
   */
  private extractArchive(
    archivePath: string,
    destinationPath: string,
    copies: IInstruction[]): Promise<void> {
    if (copies.length === 0) {
      return Promise.resolve();
    }

    let normalize: Normalize;

    const tempPath = destinationPath + '.installing';

    return fs.ensureDirAsync(tempPath)
      .then(() => getNormalizeFunc(tempPath))
      .then((normalizeFunc: Normalize) => {
        normalize = normalizeFunc;
        return;
      })
      .then(() => this.extractFileList(archivePath,
        tempPath,
        copies.map((copy) => copy.source)))
      .then(() => fs.renameAsync(tempPath, destinationPath))
      .then(() => {
        // TODO hack: the 7z command line doesn't allow files to be renamed
        //  during installation so we extract them all and then rename. This
        //  also tries to clean up dirs that are empty
        //  afterwards but ideally we get a proper 7z lib...
        const renames =
          copies.filter((inst) => inst.source !== inst.destination)
            .reduce((groups, inst) => {
              setdefault(groups, normalize(inst.source), []).push(inst.destination);
              return groups;
            }, {});
        let affectedDirs = new Set<string>();
        return Promise
          .map(Object.keys(renames),
          (source: string) => {
            return Promise.each(renames[source], (destination: string,
              index: number,
              len: number) => {
              const fullSource = path.join(destinationPath, source);
              const dest = path.join(destinationPath, destination);
              let affDir = path.dirname(fullSource);
              while (affDir.length > destinationPath.length) {
                affectedDirs.add(affDir);
                affDir = path.dirname(affDir);
              }
              // if this is the last or only destination for the source
              // file, use a rename because it's quicker. otherwise
              // copy so that further destinations can be processed
              return fs.ensureDirAsync(path.dirname(dest))
                .then(() => (index !== len - 1) ?
                  fs.copyAsync(fullSource, dest) :
                  fs.renameAsync(fullSource, dest));
            });
          })
          .then(() => Promise.each(Array.from(affectedDirs)
            .sort((lhs: string, rhs: string) =>
              rhs.length - lhs.length),
            (affectedPath: string) => {
              return fs.rmdirAsync(affectedPath)
                .catch(() => undefined);
            }));
      })
      .then(() => undefined);
  }
}

export default InstallManager;
