import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';
import { log, types, util } from 'vortex-api';

const app = appIn || remote.app;

function testDazip(instructions: types.IInstruction[]) {
  // we can't (currently) now the files are inside a dazip, the outer installer
  // has to tell us
  return Promise.resolve(false);
}

function testSupportedOuter(files: string[]) {
  const dazips = files.filter(file => path.extname(file) === '.dazip');
  return Promise.resolve({
    supported: dazips.length > 0,
    requiredFiles: dazips,
  });
}

function installOuter(files: string[],
                      destinationPath: string,
                      gameId: string,
                      progressDelegate): Promise<types.IInstallResult> {
  const dazips = files.filter(file => path.extname(file) === '.dazip');
  log('debug', 'install nested', dazips);
  const instructions = dazips.map((dazip: string): types.IInstruction => ({
                              type: 'submodule',
                              key: dazip,
                              path: path.join(destinationPath, dazip),
                              submoduleType: 'dazip',
                            }));
  return Promise.resolve({ instructions });
}

function isDragonAge(gameId: string): boolean {
  return [ 'dragonage', 'dragonage2' ].indexOf(gameId) !== -1;
}

function testIsSettings(): Promise<boolean> {
  // only used for merged files
  return Promise.resolve(false);
}

function init(context: types.IExtensionContext) {
  const getPath = (game: types.IGame) => {
    return path.join(app.getPath('documents'), 'BioWare', 'Dragon Age', 'AddIns');
  };

  const getSettingsPath = (game: types.IGame) => {
    return path.join(app.getPath('documents'), 'BioWare', 'Dragon Age', 'Settings');
  };

  context.registerModType('dazip', 25, isDragonAge, getPath, testDazip);
  context.registerModType('dragonage-settings', 999, isDragonAge, getSettingsPath, testIsSettings);
  context.registerInstaller('dazipOuter', 15, testSupportedOuter, installOuter);
  // the dazip itself is installed like a "regular" fomod, but it will have the dazip
  // modtype set from dazipOuter

  return true;
}

export default init;
