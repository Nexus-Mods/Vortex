import {gameSupported, getPath} from './gameSupport';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import * as ReduxThunk from 'redux-thunk';
import { actions, log, types, util } from 'vortex-api';
import * as Registry from 'winreg';

let gedosatoPath: string;

function getLocation(): Promise<string> {
  if (Registry === undefined) {
    return Promise.resolve(undefined);
  }

  return new Promise<string>((resolve, reject) => {
    const regKey = new Registry({
      hive: Registry.HKLM,
      key: '\\Software\\Wow6432Node\\Durante\\GeDoSaTo',
    });

    regKey.get('InstallPath', (err, result) => {
      if (err !== null) {
        return reject(new Error(err.message));
      }
      resolve(result.value);
    });
  });
}

function allDDS(files: string[]): boolean {
  return files.find(file => path.extname(file).toLowerCase() !== '.dds') === undefined;
}

let askGeDoSaTo: () => Promise<boolean>;

function testSupported(files: string[], gameId: string): Promise<types.ISupportedResult> {
  const isGeDoSaTo = gameSupported(gameId) && allDDS(files);
  const prom = !isGeDoSaTo || (gedosatoPath !== undefined)
    ? Promise.resolve(isGeDoSaTo)
    : askGeDoSaTo();

  return prom.then(choice => Promise.resolve({
    supported: isGeDoSaTo && choice,
    requiredFiles: [],
  }));
}

function makeCopy(basePath: string, filePath: string): types.IInstruction {
  return {
    type: 'copy',
    source: filePath,
    destination: basePath !== '.' ? filePath.substring(basePath.length + 1) : filePath,
  };
}

function install(files: string[],
                 destinationPath: string,
                 gameId: string,
                 progressDelegate: types.ProgressDelegate): Promise<types.IInstallResult> {
  const basePath = path.dirname(files.find(file => path.extname(file) === '.dds'));
  const instructions: types.IInstruction[] = files
      .filter(filePath => !filePath.endsWith(path.sep)
                          && ((basePath === '.') || filePath.startsWith(basePath + path.sep)))
          .map(filePath => makeCopy(basePath, filePath));

  return Promise.resolve({ instructions });
}

function isSupported(gameId: string): boolean {
  return gameSupported(gameId);
}

function init(context: types.IExtensionContext) {
  const getOutputPath = (game: types.IGame): string => {
    if (gedosatoPath !== undefined) {
      return path.join(gedosatoPath, 'textures', getPath(game.id));
    } else {
      return undefined;
    }
  };

  const testGeDoSaTo = (instructions: types.IInstruction[]) => Promise.resolve(
      allDDS(instructions.filter(instruction => instruction.type === 'copy')
                 .map(instruction => instruction.destination)));

  context.registerModType('gedosato', 50, isSupported, getOutputPath, testGeDoSaTo);
  context.registerInstaller('gedosato', 50, testSupported, install);

  askGeDoSaTo = (): Promise<boolean> => {
    return context.api.store.dispatch(actions.showDialog('question', 'GeDoSaTo not installed', {
      bbcode: 'This looks like a mod that requires the tool GeDoSaTo<br />'
              + 'To use it, you should cancel this installation now, get GeDoSaTo and then retry. '
              + 'If you continue now, the mod may not be installed correctly and will not work '
              + 'even after you install GeDoSaTo.<br />'
              + 'Download from here: [url]http://blog.metaclassofnil.com/?page_id=582[/url]<br />',
    }, [
      { label: 'Cancel', default: true },
      { label: 'Ignore' },
    ]))
    .then(result => result.action === 'Ignore'
      ? Promise.resolve(true)
      : Promise.reject(new util.UserCanceled()));
  };

  context.once(() => {
    return getLocation()
      .then(location => {
        if (location === undefined) {
          log('info', 'gedosato not installed or not found');
          return;
        }
        gedosatoPath = location;
      })
      .catch(err => {
        log('warn', 'failed to look for GeDoSaTo', { err: err.message });
      })
      ;
  });

  return true;
}

export default init;
