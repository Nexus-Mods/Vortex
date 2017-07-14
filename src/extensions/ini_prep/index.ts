import {IExtensionContext} from '../../types/IExtensionContext';
import {getSafe} from '../../util/storeHelper';
import {objDiff, setdefault} from '../../util/util';

import {activeGameId} from '../profile_management/selectors';

import {INI_TWEAKS_PATH} from '../mod_management/InstallManager';
import {IMod} from '../mod_management/types/IMod';
import {IModWithState} from '../mod_management/types/IModProps';
import resolvePath from '../mod_management/util/resolvePath';

import {iniFiles, iniFormat} from './gameSupport';
import renderINITweaks from './TweakList';

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

function getBaseFile(input: string): string {
  const match = input.match(/.*\[([^\]]*)\]\.ini/);
  if ((match !== undefined) && (match.length >= 2)) {
    return match[1] + '.ini';
  } else {
    return input;
  }
}

function bakeSettings(gameMode: string, mods: IMod[], paths: any): Promise<void> {
  const modsPath = resolvePath('install', paths, gameMode);
  const format = iniFormat(gameMode);
  if (format === undefined) {
    return Promise.resolve();
  }

  const enabledTweaks: { [baseFile: string]: string[] } = {};

  const baseFiles = iniFiles(gameMode);
  const baseFileNames = baseFiles.map(name => path.basename(name).toLowerCase());
  const parser = new IniParser(genIniFormat(format));

  // get a list of all tweaks we need to apply
  return Promise.each(mods, mod => {
    const tweaksPath =
        path.join(modsPath, mod.installationPath, INI_TWEAKS_PATH);
    const modTweaks = getSafe(mod, ['enabledINITweaks'], []);
    return fs.readdirAsync(tweaksPath)
        .then(files => {
          files.map(file => file.toLowerCase())
              .filter(file => baseFileNames.indexOf(file) !== -1 ||
                              modTweaks.indexOf(file) !== -1)
              .forEach(file => {
                setdefault(enabledTweaks, getBaseFile(file), [])
                    .push(path.join(tweaksPath, file));
              });
        })
        .catch(err => undefined);
  }).then(() => Promise.map(baseFiles, iniFileName => {
    // starting with the .base file for each ini, re-bake the file by applying
    // the ini tweaks
    const baseName = path.basename(iniFileName).toLowerCase();
    return fs.copyAsync(iniFileName + '.base', iniFileName + '.baked')
        .then(() => parser.read(iniFileName + '.baked'))
        .then(ini => Promise.each(enabledTweaks[baseName] || [],
                                  tweak => parser.read(tweak).then(patchIni => {
                                    Object.assign(ini.data, patchIni.data);
                                  }))
                         .then(() => parser.write(iniFileName + '.baked', ini))
                         .then(() => fs.copyAsync(iniFileName + '.baked',
                                                  iniFileName)));
  }))
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
  context.registerTableAttribute('mods', {
    id: 'ini-edits',
    description: 'Optional ini modifications',
    calc: () => 'Dummy',
    customRenderer: (mod: IModWithState) => renderINITweaks(mod),
    placement: 'detail',
    edit: {},
  });

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
