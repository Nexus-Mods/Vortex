/* eslint-disable */
import path from 'path';

import { fs, types, util } from 'vortex-api';
import * as winapi from 'winapi-bindings';

import { GAME_ID } from '../common';
import { toBlue } from '../helpers';
import { deploySMAPI, downloadSMAPI, findSMAPIMod } from '../SMAPI';
import { SMAPI_EXE } from '../installers/smapiInstaller';
import { defaultModsRelPath } from '../util';

/**
 * Vortex `IGame` implementation for Stardew Valley.
 *
 * This class defines how Vortex discovers and launches the game, where mods
 * should be deployed, and what setup should happen when the game mode is
 * activated.
 *
 * Key responsibilities:
 * - game discovery and executable metadata
 * - default mod path and setup flow
 * - SMAPI presence checks and install/deploy recommendation prompt
 */
class StardewValleyGame implements types.IGame {
  public context: types.IExtensionContext;
  public id: string = GAME_ID;
  public name: string = 'Stardew Valley';
  public logo: string = 'gameart.jpg';
  public requiredFiles: string[];
  public environment: { [key: string]: string } = {
    SteamAPPId: '413150',
  };
  public details: { [key: string]: any } = {
    steamAppId: 413150,
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
    },
  ];
  public mergeMods: boolean = true;
  public requiresCleanup: boolean = true;
  public shell: boolean = process.platform === 'win32';
  public defaultPaths: string[];

  /**
   * Construct an instance.
   * @param context The Vortex extension context.
   */
  constructor(context: types.IExtensionContext) {
    this.context = context;
    this.requiredFiles = process.platform == 'win32'
      ? ['Stardew Valley.exe']
      : ['StardewValley'];

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
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Stardew Valley',
    ];
  }

  /**
   * Query known stores/default locations for the install path.
   */
  public queryPath = toBlue<string>(async () => {
    const game = await util.GameStoreHelper.findByAppId([
      '413150',
      '1453375253',
      'ConcernedApe.StardewValleyPC',
    ]).catch(() => undefined);

    if (game !== undefined) {
      return game.gamePath;
    }

    for (const defaultPath of this.defaultPaths) {
      if (await this.getPathExistsAsync(defaultPath)) {
        return defaultPath;
      }
    }

    throw new Error('Stardew Valley install path not found');
  });

  public executable() {
    return process.platform == 'win32'
      ? 'Stardew Valley.exe'
      : 'StardewValley';
  }

  public queryModPath() {
    return defaultModsRelPath();
  }

  public setup = toBlue(async discovery => {
    try {
      await fs.ensureDirWritableAsync(path.join(discovery.path, defaultModsRelPath()));
    } catch (err) {
      return Promise.reject(err);
    }

    const smapiPath = path.join(discovery.path, SMAPI_EXE);
    const smapiFound = await this.getPathExistsAsync(smapiPath);
    if (!smapiFound) {
      this.recommendSmapi();
    }
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
      ],
    });
  }

  /**
   * Asynchronously check whether a file or directory path exists.
   */
  private async getPathExistsAsync(inputPath: string): Promise<boolean> {
    try {
      await fs.statAsync(inputPath);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Asynchronously read a registry key value.
   */
  private async readRegistryKeyAsync(hive: any, key: string, name: string) {
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

export default StardewValleyGame;
