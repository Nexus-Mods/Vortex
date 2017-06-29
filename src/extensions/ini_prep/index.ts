import {IExtensionContext} from '../../types/IExtensionContext';

import {activeGameId} from '../profile_management/selectors';

import {INI_TWEAKS_PATH} from '../mod_management/InstallManager';
import {IMod} from '../mod_management/types/IMod';
import resolvePath from '../mod_management/util/resolvePath';

import {iniFiles, iniFormat} from './gameSupport';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import IniParser, {IniFile, WinapiFormat} from 'parse-ini';
import * as path from 'path';

function ensureIniBackups(gameMode: string) {
  return Promise.map(iniFiles(gameMode), file => {
    const backupFile = file + '.base';
    const bakedFile = file + '.baked';
    return Promise.map(
        [backupFile, bakedFile],
        copy => fs.statAsync(copy).catch(err => fs.copyAsync(file, copy)));
  });
}

function genIniFormat(format: string) {
  switch (format) {
    case 'winapi': return new WinapiFormat();
    default: throw new Error('unsupported ini format: ' + format);
  }
}

function bakeSettings(gameMode: string, mods: IMod[], paths: any): Promise<void> {
  const modsPath = resolvePath('install', paths, gameMode);
  const format = iniFormat(gameMode);
  if (format === undefined) {
    return Promise.resolve();
  }

  const parser = new IniParser(genIniFormat(format));

  return Promise.map(iniFiles(gameMode), iniFileName => {
    let iniFile: IniFile<any>;
    return parser.read(iniFileName + '.base')
      .then(ini => {
        iniFile = ini;

        return Promise.each(mods, mod => {
          const tweaksPath =
              path.join(modsPath, mod.installationPath, INI_TWEAKS_PATH);
          return fs.readdirAsync(tweaksPath)
              .then(files =>
                Promise.each(files, editName =>
                  parser.read(path.join(tweaksPath, editName))
                      .then(editIni => {
                        Object.assign(iniFile.data, editIni.data);
                      })))
              .catch(err => undefined);
        });
      })
      .then(() => parser.write(iniFileName + '.baked', iniFile))
      .then(() => fs.copyAsync(iniFileName + '.baked', iniFileName));
  })
  .then(() => undefined);
}

function main(context: IExtensionContext) {
  context.once(() => {
    context.api.events.on('gamemode-activated', (gameMode: string) => {
      ensureIniBackups(gameMode);
    });

    context.api.events.on('bake-settings', (gameId: string, mods: IMod[],
                                            callback: (err: Error) => void) => {
      const paths = context.api.store.getState().settings.mods.paths;
      bakeSettings(gameId, mods, paths)
          .then(() => callback(null))
          .catch(err => callback(err));
    });
  });
}

export default main;
