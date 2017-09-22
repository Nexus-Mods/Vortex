import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import { types, util } from 'vortex-api';

function testSupported(files: string[]): Promise<types.ISupportedResult> {
  const supported =
    files.find(filePath => path.basename(filePath).toLowerCase() === 'enbseries.ini') !== undefined;
  return Promise.resolve({
    supported,
    requiredFiles: [],
  });
}

function makeCopy(basePath: string, filePath: string): types.IInstruction {
  return {
    type: 'copy',
    source: filePath,
    destination: filePath.substring(basePath.length + 1),
  };
}

function install(files: string[],
                 destinationPath: string,
                 gameId: string,
                 progressDelegate: types.ProgressDelegate): Promise<types.IInstallResult> {
  const baseDirs = files
    .filter(filePath => path.basename(filePath).toLowerCase() === 'enbseries.ini')
    .map(path.dirname);

  const refFile =
    files.find(filePath => path.basename(filePath).toLowerCase() === 'enbseries.ini');
  const basePath = path.dirname(refFile);

  const instructions: types.IInstruction[] = files
      .filter(filePath => !filePath.endsWith(path.sep) && filePath.startsWith(basePath + path.sep))
          .map(filePath => makeCopy(basePath, filePath));

  return Promise.resolve({ instructions });
}

function init(context: types.IExtensionContext) {
  const getPath = (game: types.IGame): string => {
    const state: types.IState = context.api.store.getState();
    const discovery = state.settings.gameMode.discovered[game.id];
    return discovery.path;
  };

  const testEnb = (instructions: types.IInstruction[]) =>
      new Promise<boolean>((resolve, reject) => {
    if (instructions.find(inst => inst.destination === 'enbseries.ini') !== undefined) {
      if (instructions.find(inst => inst.destination === 'd3d11.dll') !== undefined) {
        remote.dialog.showMessageBox(
            null,
            {
              message: context.api.translate(
                  'The mod you\'re about to install contains dll files that will run with the ' +
                  'game, have the same access to your system and can thus cause considerable ' +
                  'damage or infect your system with a virus if it\'s malicious.\n' +
                  'Please install this mod only if you received it from a trustworthy source ' +
                  'and if you have a virus scanner active right now.'),
              buttons: ['Cancel', 'Continue'],
              noLink: true,
            },
            (response: number) => {
              if (response === 1) {
                resolve(true);
              } else {
                reject(new util.UserCanceled());
              }
            });
      } else {
        resolve(true);
      }
    } else {
      resolve(false);
    }
  });

  context.registerModType('enb', 100, () => true, getPath, testEnb);
  context.registerInstaller('enb', 50, testSupported, install);

  return true;
}

export default init;
