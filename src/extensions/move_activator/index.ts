import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { activeGameId } from '../../util/selectors';

import { getGame } from '../gamemode_management';
import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import LinkingDeployment from '../mod_management/LinkingDeployment';
import { installPath } from '../mod_management/selectors';
import { IDeployedFile, IDeploymentMethod } from '../mod_management/types/IDeploymentMethod';
import resolvePath from '../mod_management/util/resolvePath';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as path from 'path';
import turbowalk, { IEntry } from 'turbowalk';
import * as util from 'util';

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

  public isSupported(state: any, gameId: string, typeId: string): string {
    const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameId];
    if ((discovery === undefined) || (discovery.path === undefined)) {
      return 'No game discovery';
    }

    const instPath = resolvePath('install', state.settings.mods.paths, gameId);

    const game: IGame = getGame(gameId);
    const modPaths = game.getModPaths(discovery.path);

    try {
      fs.accessSync(modPaths[typeId], fs.constants.W_OK);
    } catch (err) {
      log('info', 'move deployment not supported due to lack of write access',
          { typeId, path: modPaths[typeId] });
      return `Can\'t write to output directory: ${modPaths[typeId]}`;
    }

    try {
      if (fs.statSync(instPath).dev !== fs.statSync(modPaths[typeId]).dev) {
        // actually we could support this but it would be so slow it wouldn't make sense
        return 'Works only if mods are installed on the same drive as the game. '
          + 'You can go to settings and change the mod directory to the same drive '
          + 'as the game.';
      }
    } catch (err) {
      // this can happen when managing the the game for the first time
      log('info', 'failed to stat. directory missing?', {
        dir1: instPath || 'undefined', dir2: modPaths[typeId],
        err: util.inspect(err),
      });
      return 'Game not fully initialized yet, this should disappear soon.';
    }

    return undefined;
  }

  public finalize(gameId: string,
                  dataPath: string,
                  installationPath: string,
                  progressCB?: (files: number, total: number) => void): Promise<IDeployedFile[]> {
    this.mDirCache = new Set<string>();
    return super.finalize(gameId, dataPath, installationPath, progressCB)
    .then(files => {
      this.mDirCache = undefined;
      return files;
    });
  }

  protected purgeLinks(installationPath: string, dataPath: string): Promise<void> {
    const inos = new Set<number>();
    const deleteIfEmpty: string[] = [];

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
    return this.ensureDir(path.dirname(linkPath))
        .then((created: any) => {
          const tagDir = (created !== null)
            ? fs.writeFileAsync(
                path.join(created, LinkingDeployment.TAG_NAME),
                'This directory was created by Vortex deployment and will be removed ' +
                    'during purging if it\'s empty')
            : Promise.resolve();

          return tagDir.then(() => this.createLink(sourcePath, linkPath));
        });
  }

  protected unlinkFile(linkPath: string, sourcePath: string): Promise<void> {
    return this.restoreLink(sourcePath + LNK_EXT);
  }

  protected isLink(linkPath: string, sourcePath: string): Promise<boolean> {
    return fs.readFileAsync(sourcePath + LNK_EXT, { encoding: 'utf-8' })
      .then(data => JSON.parse(data).target === linkPath)
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
        const dat = JSON.parse(data);
        return fs.statAsync(dat.target);
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
        const dat = JSON.parse(data);
        const outPath = linkPath.replace(this.mLnkExpression, '');
        return fs.renameAsync(dat.target, outPath)
          .catch(err => (err.code === 'ENOENT')
              // file was deleted. Well, the user is the boss...
              ? Promise.resolve()
              : Promise.reject(err))
          .then(() => fs.removeAsync(linkPath));
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
