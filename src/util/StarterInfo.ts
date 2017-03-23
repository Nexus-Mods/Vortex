import { IDiscoveredTool } from '../types/IDiscoveredTool';
import { getSafe } from '../util/storeHelper';

import { IDiscoveryResult } from '../extensions/gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../extensions/gamemode_management/types/IGameStored';
import { IToolStored } from '../extensions/gamemode_management/types/IToolStored';

import { remote } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface IStarterInfo {
  id: string;
  gameId: string;
  isGame: boolean;
  iconPath: string;
  iconOutPath: string;
  name: string;
  exePath: string;
  commandLine: string[];
  workingDirectory: string;
  environment: { [key: string]: string };
}

/**
 * holds info about an executable to start
 * 
 * @class StarterInfo
 */
class StarterInfo implements IStarterInfo {
  public id: string;
  public gameId: string;
  public isGame: boolean;
  public iconOutPath: string;
  public name: string;
  public exePath: string;
  public commandLine: string[];
  public workingDirectory: string;
  public environment: { [key: string]: string };

  private mExtensionPath: string;
  private mLogoName: string;

  constructor(game: IGameStored, gameDiscovery: IDiscoveryResult,
              tool?: IToolStored, toolDiscovery?: IDiscoveredTool) {
    this.gameId = game.id;
    this.mExtensionPath = game.extensionPath;

    if ((tool === undefined) && (toolDiscovery === undefined)) {
      this.id = game.id;
      this.isGame = true;
      this.initFromGame(game, gameDiscovery);
    } else {
      this.id = getSafe(toolDiscovery, ['id'], getSafe(tool, ['id'], undefined));
      this.isGame = false;
      this.initFromTool(game, tool, toolDiscovery);
    }
    if ((this.id === undefined) || (this.name === undefined) || (this.mLogoName === undefined)) {
      throw new Error('invalid starter information');
    }
  }

  public get iconPath(): string {
    if (this.isGame) {
      return this.gameIcon(this.gameId, this.mExtensionPath, this.mLogoName);
    } else {
      return this.toolIcon(this.gameId, this.mExtensionPath, this.id, this.mLogoName);
    }
  }

  private initFromGame(game: IGameStored, gameDiscovery: IDiscoveryResult) {
    this.name = game.name;
    this.exePath = path.join(gameDiscovery.path, game.executable);
    this.commandLine = [];
    this.workingDirectory = gameDiscovery.path;
    this.environment = gameDiscovery.environment || {};
    this.iconOutPath = this.gameIconRW(game.id);

    this.mLogoName = game.logo;
  }

  private initFromTool(game: IGameStored, tool: IToolStored, toolDiscovery: IDiscoveredTool) {
    if (toolDiscovery !== undefined) {
      this.name = getSafe(toolDiscovery, ['name'], getSafe(tool, ['name'], undefined));
      this.exePath = toolDiscovery.path;
      this.commandLine = getSafe(toolDiscovery, ['parameters'], getSafe(tool, ['parameters'], []));
      this.environment =
        getSafe(toolDiscovery, ['environment'], getSafe(tool, ['environment'], {}));
      this.mLogoName = getSafe(toolDiscovery, ['logo'], getSafe(tool, ['logo'], undefined));
      this.workingDirectory = toolDiscovery.workingDirectory !== undefined
        ? toolDiscovery.workingDirectory
        : path.dirname(toolDiscovery.path || '');
    } else {
      // defaults for undiscovered & unconfigured tools
      this.name = tool.name;
      this.exePath = '';
      this.commandLine = tool.parameters;
      this.workingDirectory = '';
      this.environment = tool.environment;
      this.mLogoName = tool.logo;
    }
    this.iconOutPath = this.toolIconRW(game.id, this.id);
  }

  private gameIcon(gameId: string, extensionPath: string, logo: string) {
    try {
      const iconPath = this.gameIconRW(gameId);
      fs.statSync(iconPath);
      return iconPath;
    } catch (err) {
      return path.join(extensionPath, logo);
    }
  }

  private gameIconRW(gameId: string) {
    return path.join(remote.app.getPath('userData'), gameId, 'icon.png');
  }

  private toolIcon(gameId: string, extensionPath: string,
                   toolId: string, toolLogo: string): string {
    try {
      const iconPath = this.toolIconRW(gameId, toolId);
      fs.statSync(iconPath);
      return iconPath;
    } catch (err) {
      return path.join(extensionPath, toolLogo);
    }
  }
  private toolIconRW(gameId: string, toolId: string) {
    return path.join(remote.app.getPath('userData'),
      gameId, 'icons', toolId + '.png');
  }
}

export default StarterInfo;
