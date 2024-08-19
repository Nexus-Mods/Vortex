import { setSettingsPage } from '../../actions/session';
import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import { UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { log } from '../../util/log';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { getGame } from '../gamemode_management/util/getGame';
import LinkingDeployment, { IDeployment } from '../mod_management/LinkingDeployment';
import { installPathForGame } from '../mod_management/selectors';
import { IDeployedFile, IDeploymentMethod,
         IUnavailableReason } from '../mod_management/types/IDeploymentMethod';

import Promise from 'bluebird';
import { TFunction } from 'i18next';
import * as path from 'path';
import turbowalk, { IEntry } from 'turbowalk';
import * as util from 'util';
import * as winapi from 'winapi-bindings';

const LNK_EXT = '.vortex_lnk';

interface ILinkData {
  target: string;
}

export class FileFound extends Error {
  constructor(name) {
    super(name);
    this.name = this.constructor.name;
  }
}

class DeploymentMethod extends LinkingDeployment {
  public priority: number = 50;

  private mLnkExpression = new RegExp(LNK_EXT + '$');

  constructor(api: IExtensionApi) {
    super(
        'move_activator', 'Move deployment (Experimental!)',
        'Deploys mods by actually moving files to the destination directory.',
        false,
        api);
  }

  public detailedDescription(t: TFunction): string {
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

    if ((game.details?.supportsMoveActivator === false)
      || (game.compatible?.moveActivator === false)) {
    return { description: t => t('Game doesn\'t support the move deployment method') };
  }

    try {
      fs.accessSync(modPaths[typeId], fs.constants.W_OK);
    } catch (err) {
      log('info', 'move deployment not supported due to lack of write access',
          { typeId, path: modPaths[typeId] });
      return {
        description: t => t('Can\'t write to output directory'),
        order: 3,
        solution: t => t('To resolve this problem, the current user account needs to '
                       + 'be given write permission to "{{modPath}}".', {
          replace: {
            modPath: modPaths[typeId],
          },
        }),
      };
    }

    try {
      if (fs.statSync(instPath).dev !== fs.statSync(modPaths[typeId]).dev) {
        // actually we could support this but it would be so slow it wouldn't make sense

        return {
          description: t => t('Works only if mods are installed on the same drive as the game'),
          order: 8,
          solution: t => {
            let displayPath = modPaths[typeId];
            try {
              displayPath = winapi.GetVolumePathName(modPaths[typeId]);
            } catch (err) {
              log('warn', 'Failed to resolve volume path', { path: modPaths[typeId] });
            }
            return t('Please go to Settings->Mods and set the mod staging folder to be on '
              + 'the same drive as the game ({{gameVolume}}).', {
                replace: {
                  gameVolume: displayPath,
                },
              });
          },
          fixCallback: (api: IExtensionApi) => new Promise((resolve, reject) => {
            api.events.emit('show-main-page', 'application_settings');
            api.store.dispatch(setSettingsPage('Mods'));
            api.highlightControl('#install-path-form', 5000,
                                 'Change this to be on the same drive as the game.');
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

  public onSelected(api: IExtensionApi): Promise<void> {
    return api.showDialog('question', 'Move Deployment', {
      text: 'You\'re about to enable "Move Deployment".\n'
          + 'Please note that move deployment is slightly slower, uses more disk space and is less '
          + 'robust regarding changes from external applications than "Hardlink Deployment".\n'
          + 'There are no advantages compared to hardlink deployment except that it also works '
          + 'on exFAT/FAT32 formatted drives.\n'
          + 'So please only use this if hardlink really is no option.',
    }, [
      { label: 'Cancel' },
      { label: 'Continue' },
    ])
    .then(result => result.action === 'Cancel'
      ? Promise.reject(new UserCanceled())
      : Promise.resolve());
  }

  public finalize(gameId: string,
                  dataPath: string,
                  installationPath: string,
                  progressCB?: (files: number, total: number) => void): Promise<IDeployedFile[]> {
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

    return super.finalize(gameId, dataPath, installationPath, progressCB);
  }

  public deactivate(sourcePath: string, dataPath: string, sourceName: string): Promise<void> {
    return turbowalk(sourcePath, entries => {
      if (this.context === undefined) {
        return;
      }
      entries.forEach(entry => {
        if (!entry.isDirectory && (path.extname(entry.filePath) === LNK_EXT)) {
          const relPath: string = path.relative(sourcePath,
            entry.filePath.substring(0, entry.filePath.length - LNK_EXT.length));
          const normPath = this.normalize(relPath);
          if ((this.context.newDeployment[normPath] !== undefined)
              && (this.context.newDeployment[normPath].source === sourceName)) {
            delete this.context.newDeployment[normPath];
          }
        }
      });
    });
  }

  public getDeployedPath(input: string): string {
    if (path.extname(input) === LNK_EXT) {
      return input.substring(0, input.length - LNK_EXT.length);
    }
    return input;
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

  protected linkFile(linkPath: string, sourcePath: string, dirTags?: boolean): Promise<void> {
    if (path.extname(sourcePath) === LNK_EXT) {
      // sanity check, don't link the links
      return Promise.resolve();
    }
    const basePath = path.dirname(linkPath);
    return this.ensureDir(basePath)
        .then(() => this.createLink(sourcePath, linkPath));
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
          log('error', 'invalid link', { link: sourcePath + LNK_EXT, data });
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
      .catch(err => (err.code === 'ENOENT')
        ? this.statVortexLink(filePath)
        : Promise.reject(err));
  }

  protected statLink(filePath: string): Promise<fs.Stats> {
    return Promise.resolve(fs.lstatAsync(filePath));
  }

  private readLink(filePath: string): Promise<ILinkData> {
    return fs.readFileAsync(filePath + LNK_EXT, { encoding: 'utf-8' })
      .then(data => {
        try {
          const obj: ILinkData = JSON.parse(data);
          if (obj.target === undefined) {
            throw new Error('target missing');
          }
          return Promise.resolve(obj);
        } catch (err) {
          const error: any = new Error('Invalid link');
          error.code = 'ENOENT';
          error.path = filePath;
          return Promise.reject(error);
        }
      });
  }

  private statVortexLink(filePath: string): Promise<fs.Stats> {
    return this.readLink(filePath)
      .then(linkInfo => fs.statAsync(linkInfo.target));
  }

  private createLink(sourcePath: string, linkPath: string): Promise<void> {
    const linkInfo = JSON.stringify({
      target: linkPath,
    });
    // if the sourcePath doesn't exist but a link placeholder, restore the link
    // first before creating it again
    return fs.statAsync(sourcePath)
      .catch({ code: 'ENOENT' }, () => fs.statAsync(sourcePath + LNK_EXT)
        .then(() => this.restoreLink(sourcePath + LNK_EXT)))
      .then(() => fs.writeFileAsync(sourcePath + LNK_EXT, linkInfo, { encoding: 'utf-8' }))
      .then(() => fs.statAsync(sourcePath).then(stat =>
        // TODO: Hmm, unfortunately this seems to be really slow (on windows at least)
        //   The alternative would be to store mtime in the linkInfo and then use that when
        //   checking if the content has changed (not that that could happen with move
        //   deployment anyway)
        fs.utimesAsync(sourcePath + LNK_EXT, stat.atime as any, stat.mtime as any)))
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
              // how did we successfully deploy if this is on a different drive?
              // if the game was moved the links shouldn't point to a valid location,
              // if the staging folder was moved we should have purged
              : (err.code === 'EXDEV')
              ? fs.moveAsync(dat.target, outPath)
              : Promise.reject(err))
            .then(() => fs.removeAsync(linkPath));
        } catch (err) {
          log('error', 'invalid link', { linkPath, data });
          const error: any = new Error('Invalid link');
          error.code = 'ENOENT';
          error.path = linkPath;
          return Promise.reject(error);
        }
      });
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
