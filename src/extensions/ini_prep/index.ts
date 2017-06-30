import {IExtensionContext} from '../../types/IExtensionContext';
import {objDiff} from '../../util/util';

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

function applyDelta(data: any, delta: any) {
  if (typeof(delta) !== 'object') {
    return;
  }

  Object.keys(delta).forEach(key => {
    if (key[0] === '-') {
      delete data[key.slice(1)];
    } else if (key[0] === '+') {
      data[key.slice(1)] = delta[key];
    } else {
      applyDelta(data[key], delta[key]);
    }
  });
}

function discoverSettingsChanges(gameMode: string): Promise<void> {
  const format = iniFormat(gameMode);
  if (format === undefined) {
    return Promise.resolve();
  }

  const parser = new IniParser(genIniFormat(format));

  return Promise.map(iniFiles(gameMode), iniFileName => {
    let newContent: any;
    let oldContent: any;
    return parser.read(iniFileName)
      .then(ini => {
        newContent = ini.data;
        return parser.read(iniFileName + '.baked');
      })
      .then(ini => {
        oldContent = ini.data;
        return parser.read(iniFileName + '.base');
      })
      .then(ini => {
        const delta = objDiff(oldContent, newContent);
        applyDelta(ini.data, delta);
        return parser.write(iniFileName + '.base', ini);
      });
  })
  .then(() => undefined);
}

function bakeSettings(gameMode: string, mods: IMod[], paths: any): Promise<void> {
  const modsPath = resolvePath('install', paths, gameMode);
  const format = iniFormat(gameMode);
  if (format === undefined) {
    return Promise.resolve();
  }

  const parser = new IniParser(genIniFormat(format));

  return Promise.map(iniFiles(gameMode), iniFileName =>
    fs.copyAsync(iniFileName + '.base', iniFileName + '.baked')
      .then(() => parser.read(iniFileName + '.baked'))
      .then(ini => Promise.each(mods, mod => {
          const tweaksPath =
              path.join(modsPath, mod.installationPath, INI_TWEAKS_PATH);
          return fs.readdirAsync(tweaksPath)
              .then(files =>
                Promise.each(files, editName =>
                  parser.read(path.join(tweaksPath, editName))
                      .then(editIni => {
                        Object.assign(ini.data, editIni.data);
                      })))
              .catch(err => undefined);
        })
        .then(() => parser.write(iniFileName + '.baked', ini)))
      .then(() => fs.copyAsync(iniFileName + '.baked', iniFileName)))
  .then(() => undefined);
}

function purgeChanges(gameMode: string) {
  return Promise.map(
      iniFiles(gameMode),
      iniFileName =>
          fs.copyAsync(iniFileName + '.base', iniFileName + '.baked')
              .then(() => fs.copyAsync(iniFileName + '.base', iniFileName)));
}

function main(context: IExtensionContext) {
  context.once(() => {
    context.api.events.on('gamemode-activated', (gameMode: string) => {
      ensureIniBackups(gameMode);
    });

    context.api.events.on('bake-settings', (gameId: string, mods: IMod[],
                                            callback: (err: Error) => void) => {
      const paths = context.api.store.getState().settings.mods.paths;
      discoverSettingsChanges(gameId)
        .then(() => bakeSettings(gameId, mods, paths))
        .then(() => callback(null))
        .catch(err => callback(err));
    });

    context.api.events.on('purge-mods', () => {
      const gameMode = activeGameId(context.api.store.getState());
      discoverSettingsChanges(gameMode)
        .then(() => purgeChanges(gameMode));
    });
  });
}

export default main;
