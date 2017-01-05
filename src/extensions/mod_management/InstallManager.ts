import {showDialog} from '../../actions/notifications';
import {IExtensionContext} from '../../types/IExtensionContext';
import {log} from '../../util/log';

import {IDownload} from '../download_management/types/IDownload';

import {IDependency} from './types/IDependency';
import {IInstall} from './types/IInstall';
import {IModInstaller} from './types/IModInstaller';
import {ISupportedResult, ITestSupported} from './types/ITestSupported';
import gatherDependencies from './util/dependencies';
import filterModInfo from './util/filterModInfo';

import InstallContext from './InstallContext';
import {downloadPath} from './selectors';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import {ILookupResult, IReference, IRule} from 'modmeta-db';
import Zip = require('node-7z');
import * as path from 'path';

interface IZipEntry {
  date: Date;
  attr: string;
  size: number;
  name: string;
}

/**
 * central class for the installation process
 * 
 * @class InstallManager
 */
class InstallManager {
  private mInstallers: IModInstaller[] = [];
  private mGetInstallPath: () => string;
  private mTask = new Zip();

  constructor(installPath: () => string) { this.mGetInstallPath = installPath; }

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
  public addInstaller(priority: number, testSupported: ITestSupported,
                      install: IInstall) {
    this.mInstallers.push({priority, testSupported, install});
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
   * @param {string} installPath path to install mods into (not including the
   * mod name)
   * @param {IExtensionContext} context extension context
   * @param {*} modInfo existing information about the mod (i.e. stuff retrieved
   * from nexus)
   */
  public install(archiveId: string, archivePath: string, context: IExtensionContext,
                 info: any, processDependencies: boolean,
                 callback?: (error: Error, id: string) => void) {
    const installContext = new InstallContext(context.api.store.dispatch);

    const baseName = path.basename(archivePath, path.extname(archivePath));
    let destinationPath: string;
    let fullInfo = Object.assign({}, info);

    installContext.startInstallCB(baseName, archiveId, destinationPath);

    let fileList: IZipEntry[] = [];

    context.api.lookupModMeta(archivePath, {})
        .then((modInfo: ILookupResult[]) => {
          if (modInfo.length > 0) {
            fullInfo.meta = modInfo[0].value;
          }

          const installName = this.deriveInstallName(baseName, fullInfo);
          destinationPath = path.join(this.mGetInstallPath(), installName);

          // get list of files in the archive
          return new Promise((resolve, reject) => {
            this.mTask.list(archivePath, {})
                .progress((files: any[]) => { fileList.push(...files); })
                .then(() => { resolve(); });
          });
        })
        .then(() => {
          return this.getInstaller(fileList.map((entry: IZipEntry) => entry.name));
        }).then((installer: IModInstaller) => {
          if (installer === undefined) {
            throw new Error('no installer supporting this file');
          }
          return installer.install(fileList.map((entry: IZipEntry) => entry.name), destinationPath,
            (perc: number) => log('info', 'progress', perc));
        }).then((result: any) => {
          log('info', 'result', result);
          installContext.setInstallPathCB(baseName, destinationPath);
          return this.extractArchive(archivePath, destinationPath);
        })
        .then(() => {
          const filteredInfo = filterModInfo(fullInfo);
          installContext.finishInstallCB(baseName, true, filteredInfo);
          if (processDependencies) {
            this.installDependencies(filteredInfo.rules, this.mGetInstallPath(),
                                     installContext, context);
          }
          if (callback !== undefined) {
            callback(null, baseName);
          }
        })
        .catch((err) => {
          installContext.reportError('failed to extract', err);
          installContext.finishInstallCB(baseName, false);
          if (callback !== undefined) {
            callback(err, baseName);
          }
        });
  }

  private getInstaller(fileList: string[],
                       offsetIn?: number): Promise<IModInstaller> {
    let offset = offsetIn || 0;
    if (offset >= this.mInstallers.length) {
      return Promise.resolve(undefined);
    }
    return this.mInstallers[offset].testSupported(fileList).then(
        (testResult: ISupportedResult) => {
          if (testResult.supported === true) {
            return Promise.resolve(this.mInstallers[offset]);
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
   * mod,
   *   the specific "component" and the version. And then we need to avoid
   * collisions.
   *   Finally, the way I know users they will want to customize this.
   *
   * @param {string} archiveName
   * @param {*} info
   * @returns
   */
  private deriveInstallName(archiveName: string, info: any) {
    return archiveName;
  }

  private downloadModAsync(requirement: IReference, sourceURI: string,
                           context: IExtensionContext): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (!context.api.events.emit('start-download', [sourceURI], {},
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

  private doInstallDependencies(dependencies: IDependency[],
                                context: IExtensionContext): Promise<void> {
    return Promise.all(dependencies.map((dep: IDependency) => {
                    if (dep.download === undefined) {
                      return this.downloadModAsync(
                                     dep.reference,
                                     dep.lookupResults[0].value.sourceURI,
                                     context)
                          .then((downloadId: string) => {
                            return this.installModAsync(dep.reference, context,
                                                        downloadId);
                          });
                    } else {
                      return this.installModAsync(dep.reference, context,
                                                  dep.download);
                    }
                  }))
        .catch((err) => {
          context.api.showErrorNotification('Failed to install dependencies',
                                            err.message);
        })
        .then(() => undefined);
  }

  private installDependencies(rules: IRule[], installPath: string,
                              installContext: InstallContext,
                              context: IExtensionContext): Promise<void> {
    let notificationId = `${installPath}_activity`;
    context.api.sendNotification({
      id: notificationId,
      type: 'activity',
      message: 'Checking dependencies',
    });
    return gatherDependencies(rules, context)
        .then((dependencies: IDependency[]) => {
          context.api.dismissNotification(notificationId);

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

            context.api.store.dispatch(
                showDialog('question', 'Install Dependencies', {message}, {
                  "Don't install": null,
                  Install:
                      () => this.doInstallDependencies(dependencies, context),
                }));
          });
        })
        .catch((err) => {
          context.api.dismissNotification(notificationId);
          context.api.showErrorNotification('Failed to check dependencies',
                                            err);
        });
  }

  private installModAsync(requirement: IReference, context: IExtensionContext,
                          downloadId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const state = context.api.store.getState();
      let download: IDownload = state.persistent.downloads.files[downloadId];
      let fullPath: string = path.join(downloadPath(state), download.localPath);
      this.install(downloadId, fullPath, context, download.modInfo, false,
                   (error, id) => {
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
  private extractArchive(archivePath: string,
                         destinationPath: string): Promise<void> {
    let extract7z = this.mTask.extractFull;

    log('info', 'installing archive', {archivePath, destinationPath});

    return Promise.resolve(
        extract7z(archivePath, destinationPath + '.installing', {})
            .then((args: string[]) => {
              return fs.renameAsync(destinationPath + '.installing',
                                    destinationPath);
            }))
            .then(() => undefined);
  }
}

export default InstallManager;
