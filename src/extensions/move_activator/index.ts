import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import * as fs from '../../util/fs';
import { log } from '../../util/log';

import { getGame } from '../gamemode_management/util/getGame';
import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import LinkingDeployment, { IDeployment } from '../mod_management/LinkingDeployment';
import { installPathForGame } from '../mod_management/selectors';
import { IMod } from '../mod_management/types/IMod';
import { IDeployedFile, IDeploymentMethod, IUnavailableReason } from '../mod_management/types/IDeploymentMethod';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as path from 'path';
import turbowalk, { IEntry } from 'turbowalk';
import * as util from 'util';
import * as winapi from 'winapi-bindings';
import { setSettingsPage } from '../../actions/session';

const LNK_EXT = '.vortex_lnk';

export class FileFound extends Error {
  constructor(name) {
    super(name);
    this.name = this.constructor.name;
  }
}

class DeploymentMethod extends LinkingDeployment {
  private mDirCache: Set<string>;
  private mLnkExpression = new RegExp(LNK_EXT + '$');

  constructor(api: IExtensionApi) {
    super(
        'move_activator', 'Move deployment (Experimental!)',
        'Deploys mods by actually moving files to the destination directory.',
        false,
        api);
  }

  public detailedDescription(t: I18next.TranslationFunction): string {
    return t(
      'This deployment method doesn\'t use links but actually moves files to the destination '
      + 'directory.\nFor every deployed file it creates a lnk file in the source location to '
      + 'allow clean undeployment.\n'
      + 'Advantages:\n'
      + ' - perfect game compatibility\n'
      + ' - no performance penalty\n'
      + ' - perfect OS/FS support\n'
      + 'Disadvantages:\n'
      + ' - if mods aren\'t on the same partition as the game this will be extremely slow\n'
      + ' - purging from a different vortex instance won\'t be possible\n'
      + ' - easier to break since the game directory contains real files.');
  }

  public isSupported(state: any, gameId: string, typeId: string): IUnavailableReason {
    const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameId];
    if ((discovery === undefined) || (discovery.path === undefined)) {
      return { description: t => t('Game not discovered.') };
    }

    const instPath = installPathForGame(state, gameId);

    const game: IGame = getGame(gameId);
    const modPaths = game.getModPaths(discovery.path);

    try {
      fs.accessSync(modPaths[typeId], fs.constants.W_OK);
    } catch (err) {
      log('info', 'move deployment not supported due to lack of write access',
          { typeId, path: modPaths[typeId] });
      return {
        description: t => t('Can\'t write to output directory'),
        order: 3,
        solution: t => t('To resolve this problem, the current user account needs to be given write permission to "{{modPath}}".', {
          replace: {
            modPath: modPaths[typeId],
          }
        }),
      };
    }

    try {
      if (fs.statSync(instPath).dev !== fs.statSync(modPaths[typeId]).dev) {
        // actually we could support this but it would be so slow it wouldn't make sense
        return {
          description: t => t('Works only if mods are installed on the same drive as the game'),
          order: 8,
          solution: t => t('Please go to Settings->Mods and set the mod staging folder to be on the same '
            + 'drive as the game ({{gameVolume}}).', {
              replace: {
                gameVolume: winapi.GetVolumePathName(modPaths[typeId]),
              }
            }),
          fixCallback: (api: IExtensionApi) => new Promise((resolve, reject) => {
            api.events.emit('show-main-page', 'application_settings');
            api.store.dispatch(setSettingsPage('Mods'));
            api.highlightControl('#install-path-form', 5000, 'Change this to be on the same drive as the game.');
          }),
        };
      }
    } catch (err) {
      // this can happen when managing the the game for the first time
      log('info', 'failed to stat. directory missing?', {
        dir1: instPath || 'undefined', dir2: modPaths[typeId],
        err: util.inspect(err),
      });
      return { description: t => t('Game not fully initialized yet, this should disappear soon.') };
    }

    return undefined;
  }

  public finalize(gameId: string,
                  dataPath: string,
                  installationPath: string,
                  progressCB?: (files: number, total: number) => void): Promise<IDeployedFile[]> {
    this.mDirCache = new Set<string>();

    const deployment: IDeployment = this.context.newDeployment;
    const lnkExtUpper = LNK_EXT.toUpperCase();
    const extLen = LNK_EXT.length;
    this.context.newDeployment = Object.keys(deployment)
      .reduce((prev: IDeployment, relPath: string) => {
        if (path.extname(relPath) === lnkExtUpper) {
          deployment[relPath].relPath =
            deployment[relPath].relPath.substr(0, relPath.length - extLen);
          prev[relPath.substr(0, relPath.length - extLen)] = deployment[relPath];
        } else {
          prev[relPath] = deployment[relPath];
        }
        return prev;
      }, {});

    return super.finalize(gameId, dataPath, installationPath, progressCB)
    .then(files => {
      this.mDirCache = undefined;
      return files;
    });
  }

  public deactivate(sourcePath: string, dataPath: string): Promise<void> {
    return turbowalk(sourcePath, entries => {
      if (this.context === undefined) {
        return;
      }
      entries.forEach(entry => {
        if (!entry.isDirectory && (path.extname(entry.filePath) === LNK_EXT)) {
          const relPath: string = path.relative(sourcePath,
            entry.filePath.substring(0, entry.filePath.length - LNK_EXT.length));
          delete this.context.newDeployment[this.normalize(relPath)];
        }
      });
    });
  }

  protected purgeLinks(installationPath: string, dataPath: string): Promise<void> {
    let links: IEntry[] = [];

    // find lnk files in our mods directory
    return turbowalk(installationPath,
      entries => {
        links = links.concat(entries.filter(entry => path.extname(entry.filePath) === LNK_EXT));
      },
      {
        details: true,
      })
      .then(() => Promise.map(links, entry => this.restoreLink(entry.filePath)));
  }

  protected linkFile(linkPath: string, sourcePath: string): Promise<void> {
    if (path.extname(sourcePath) === LNK_EXT) {
      // sanity check, don't link the links
      return Promise.resolve();
    }
    const basePath = path.dirname(linkPath);
    return this.ensureDir(basePath)
        .then((created: any) => {
          let tagDir;
          if (created !== null) {
            const tagPath = path.join(created, LinkingDeployment.NEW_TAG_NAME);
            tagDir = fs.writeFileAsync(tagPath,
                'This directory was created by Vortex deployment and will be removed '
                + 'during purging if it\'s empty');
          } else {
            tagDir = Promise.resolve();
          }

          return tagDir.then(() => this.createLink(sourcePath, linkPath));
        });
  }

  protected unlinkFile(linkPath: string, sourcePath: string): Promise<void> {
    return this.restoreLink(sourcePath + LNK_EXT);
  }

  protected isLink(linkPath: string, sourcePath: string): Promise<boolean> {
    return fs.readFileAsync(sourcePath + LNK_EXT, { encoding: 'utf-8' })
      .then(data => {
        try {
          return JSON.parse(data).target === linkPath;
        } catch (err) {
          log('error', 'invalid link', data);
          return false;
        }
      })
      .catch(err => (err.code === 'ENOENT')
        ? Promise.resolve(false)
        : Promise.reject(err));
  }

  protected canRestore(): boolean {
    return true;
  }

  protected stat(filePath: string): Promise<fs.Stats> {
    return fs.statAsync(filePath)
      .catch(err => err.code === 'ENOENT'
        ? this.statVortexLink(filePath)
        : Promise.reject(err));
  }

  protected statLink(filePath: string): Promise<fs.Stats> {
    return fs.lstatAsync(filePath);
  }

  private statVortexLink(filePath: string): Promise<fs.Stats> {
    return fs.readFileAsync(filePath + LNK_EXT, { encoding: 'utf-8' })
      .then(data => {
        try {
          const dat = JSON.parse(data);
          return fs.statAsync(dat.target);
        } catch (err) {
          log('error', 'invalid link', data);
          const error: any = new Error('Invalid link');
          error.code = 'ENOENT';
          error.path = filePath;
          return Promise.reject(error);
        }
      });
  }

  private createLink(sourcePath: string, linkPath: string): Promise<void> {
    const linkInfo = JSON.stringify({
      target: linkPath,
    });
    return fs.writeFileAsync(sourcePath + LNK_EXT, linkInfo, { encoding: 'utf-8' })
      .then(() => fs.renameAsync(sourcePath, linkPath));
  }

  private restoreLink(linkPath: string): Promise<void> {
    return fs.readFileAsync(linkPath, { encoding: 'utf-8' })
      .then(data => {
        try {
          const dat = JSON.parse(data);
          const outPath = linkPath.replace(this.mLnkExpression, '');
          return fs.renameAsync(dat.target, outPath)
            .catch(err => (err.code === 'ENOENT')
              // file was deleted. Well, the user is the boss...
              ? Promise.resolve()
              : Promise.reject(err))
            .then(() => fs.removeAsync(linkPath));
        } catch (err) {
          log('error', 'invalid link', data);
          const error: any = new Error('Invalid link');
          error.code = 'ENOENT';
          error.path = linkPath;
          return Promise.reject(error);
        }
      });
  }

  private ensureDir(dirPath: string): Promise<void> {
    return (this.mDirCache === undefined) || !this.mDirCache.has(dirPath)
      ? fs.ensureDirAsync(dirPath).then(created => { this.mDirCache.add(dirPath); return created; })
      : Promise.resolve(null);
  }
}

export interface IExtensionContextEx extends IExtensionContext {
  registerDeploymentMethod: (activator: IDeploymentMethod) => void;
}

function init(context: IExtensionContextEx): boolean {
  context.registerDeploymentMethod(new DeploymentMethod(context.api));

  return true;
}

export default init;
