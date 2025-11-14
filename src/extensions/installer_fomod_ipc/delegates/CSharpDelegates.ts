import path from 'path';
import minimatch from 'minimatch';
import turbowalk, { IEntry } from 'turbowalk';
import IniParser, { WinapiFormat } from 'vortex-parse-ini';
import { getIniFilePath } from '../../installer_fomod_shared/utils/gameSupport';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { statAsync, readFileAsync } from '../../../util/fs';
import { currentGame, currentGameDiscovery } from '../../gamemode_management/selectors';
import { getGame } from '../../gamemode_management/util/getGame';
import { showError } from '../../../util/message';
import { isNullOrWhitespace } from '../../../util/util';

const extenderForGame = (gameId: string) => {
  return {
    morrowind: 'mwse',
    oblivion: 'obse',
    skyrim: 'skse',
    skyrimse: 'skse64',
    skyrimvr: 'skse64',
    fallout3: 'fose',
    falloutnv: 'nvse',
    fallout4: 'f4se',
    fallout4vr: 'f4se',
    starfield: 'sfse',
  }[gameId];
}

/**
 * Core delegates for FOMOD installer IPC communication
 * These are called by the C# installer process to query game/mod state
 */
export class CSharpDelegates {
  private mApi: IExtensionApi;
  private parser: IniParser;

  public constructor(api: IExtensionApi) {
    this.mApi = api;
    this.parser = new IniParser(new WinapiFormat());
  }

  public reportError(title: string, message: string, details: string) {
    try {
      let msg = message;
      if (details) {
        msg += '\n' + details;
      }
      this.mApi.showErrorNotification?.(title, details ?? undefined,
        { isHTML: true, allowReport: false, message: msg });
    } catch (err) {
      showError(this.mApi.store.dispatch, 'Failed to display error message from installer', err);
    }
  }

  /**
   * Check if a script extender is present
   */
  public async isExtenderPresent(): Promise<boolean> {
    const state = this.mApi.getState();
    const game = currentGame(state);
    const discovery = currentGameDiscovery(state);

    const extender = extenderForGame(game.id);
    if (extender === undefined) {
      return false;
    }

    if (!discovery?.path) {
      return false;
    }

    const sePath = path.join(discovery.path, `${extender}_loader.exe`);
    try {
      await statAsync(sePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a file exists in the game directory
   */
  public async checkIfFileExists(fileName: string): Promise<boolean> {
    const fullPath = this.resolveFilePath(fileName);
    try {
      await statAsync(fullPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get the contents of an existing data file
   */
  public async getExistingDataFile(dataFile: string): Promise<Buffer> {
    const fullPath = this.resolveFilePath(dataFile);

    try {
      return await readFileAsync(fullPath);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a list of files in a directory
   */
  public async getExistingDataFileList(folderPath: string, searchFilter: string, isRecursive: boolean): Promise<string[]> {
    const fullPath = this.resolveFilePath(folderPath);

    const filterFunc = isNullOrWhitespace(searchFilter)
      ? () => true
      : (input: IEntry) => minimatch(path.basename(input.filePath), searchFilter);

    return this.readDir(fullPath, isRecursive, filterFunc);
  }

  /**
   * Get a string value from an INI file
   */
  public async getIniString(selectedFile: string, iniSection: string, iniKey: string) {
    const state = this.mApi.getState();
    const game = currentGame(state);
    const gameInfo = getGame(game.id);

    let iniValue: string;
    let baseIniFile = getIniFilePath(gameInfo.id);

    if (!isNullOrWhitespace(selectedFile)) {
      baseIniFile = path.join(path.dirname(baseIniFile), selectedFile);
    }

    const iniFile = await this.parser.read(baseIniFile);
    Object.keys(iniFile.data).forEach((key: string) => {
      if (iniSection === key) {
        Object.keys(iniFile.data[key]).forEach((subkey: string) => {
          if (iniKey === subkey) {
            iniValue = iniFile.data[key][subkey];
          }
        });
      }
    });
    return iniValue;
  }

  /**
   * Get an integer value from an INI file
   */
  public async getIniInt(selectedFile: string, iniSection: string, iniKey: string) {
    const state = this.mApi.getState();
    const game = currentGame(state);
    const gameInfo = getGame(game.id);

    let iniValue: number;
    let baseIniFile = getIniFilePath(gameInfo.id);

    if (!isNullOrWhitespace(selectedFile)) {
      baseIniFile = path.join(path.dirname(baseIniFile), selectedFile);
    }

    const iniFile = await this.parser.read(baseIniFile);
    this.parser.read(baseIniFile)
    Object.keys(iniFile.data).forEach((key: string) => {
      if (iniSection === key) {
        Object.keys(iniFile.data[key]).forEach((subkey: string) => {
          if (iniKey === subkey) {
            iniValue = +(iniFile.data[key][subkey]);
          }
        });
      }
    });
    return iniValue;
  }


  private resolveFilePath(filePath: string): string {
    const state = this.mApi.getState();
    const game = currentGame(state);
    const discovery = currentGameDiscovery(state);
    const gameInfo = getGame(game.id);

    if (!discovery?.path) {
      throw new Error('Game discovery path is not available');
    }

    let modPath = gameInfo.queryModPath(discovery.path);
    if (!path.isAbsolute(modPath)) {
      modPath = path.join(discovery.path, modPath);
    }
    return path.join(modPath, filePath);
  }

  private readDir = async (rootPath: string, recurse: boolean, filterFunc: (entry: IEntry) => boolean): Promise<string[]> => {
    let fileList: string[] = [];

    await turbowalk(rootPath, entries => {
      fileList = fileList.concat(
        entries
          .filter(iter => !iter.isDirectory)
          .filter(filterFunc)
          // in the past this mapped to a path relative to rootPath but NMM
          // clearly returns absolute paths. Obviously there is no documentation
          // for the _expected_ behavior
          .map(iter => iter.filePath));
    }, { recurse });

    return fileList;
  }
}
