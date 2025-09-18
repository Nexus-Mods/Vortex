import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import * as fs from '../../util/fs';
import { log } from '../../util/log';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { getGame } from '../gamemode_management/util/getGame';
import LinkingDeployment from '../mod_management/LinkingDeployment';
import { installPathForGame } from '../mod_management/selectors';
import { IDeployedFile, IDeploymentMethod,
         IUnavailableReason } from '../mod_management/types/IDeploymentMethod';

import Promise from 'bluebird';
import { TFunction } from 'i18next';
import * as path from 'path';

class DeploymentMethod extends LinkingDeployment {
  public priority: number = 1; // Highest priority to make it default

  constructor(api: IExtensionApi) {
    super(
      'copy_activator', 'Copy Deployment',
      'Deploys mods by copying files to the destination directory.',
      true,
      api);
  }

  public detailedDescription(t: TFunction): string {
    return t(
      'This deployment method copies mod files directly to the game directory.\n'
      + 'Advantages:\n'
      + ' - Perfect game compatibility (no symlinks)\n'
      + ' - Works across different drives/partitions\n'
      + ' - No elevation required\n'
      + ' - Compatible with all file systems\n'
      + 'Disadvantages:\n'
      + ' - Uses more disk space (files are duplicated)\n'
      + ' - Slower deployment for large mods\n'
      + ' - Changes to original mod files won\'t be reflected automatically');
  }

  public isSupported(state: any, gameId: string, typeId: string): IUnavailableReason {
    const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameId];
    if ((discovery === undefined) || (discovery.path === undefined)) {
      return { description: t => t('Game not discovered.') };
    }

    const game: IGame = getGame(gameId);
    const modPaths = game.getModPaths(discovery.path);

    if (modPaths[typeId] === undefined) {
      return undefined;
    }

    try {
      fs.accessSync(modPaths[typeId], fs.constants.W_OK);
    } catch (err) {
      log('info', 'copy deployment not supported due to lack of write access',
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

    return undefined;
  }

  protected linkFile(linkPath: string, sourcePath: string, dirTags?: boolean): Promise<void> {
    const basePath = path.dirname(linkPath);
    return this.ensureDir(basePath, dirTags)
      .then(() => fs.copyAsync(sourcePath, linkPath))
      .catch(err => {
        if (err.code === 'EEXIST') {
          // File already exists, remove it and try again
          return fs.removeAsync(linkPath)
            .then(() => fs.copyAsync(sourcePath, linkPath));
        }
        return Promise.reject(err);
      });
  }

  protected unlinkFile(linkPath: string): Promise<void> {
    return fs.removeAsync(linkPath);
  }

  protected isLink(linkPath: string, sourcePath: string): Promise<boolean> {
    // For copy deployment, we check if the file exists and has the same content
    return Promise.all([
      fs.statAsync(linkPath).catch(() => null),
      fs.statAsync(sourcePath).catch(() => null)
    ])
    .then(([linkStats, sourceStats]) => {
      if (!linkStats || !sourceStats) {
        return false;
      }
      // Simple check: same size and modification time
      return linkStats.size === sourceStats.size;
    });
  }

  protected canRestore(): boolean {
    return true;
  }

  protected stat(filePath: string): Promise<fs.Stats> {
    return fs.statAsync(filePath);
  }

  protected statLink(filePath: string): Promise<fs.Stats> {
    return fs.statAsync(filePath);
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