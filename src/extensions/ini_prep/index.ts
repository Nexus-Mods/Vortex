import {IExtensionContext} from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import deepMerge from '../../util/deepMerge';
import * as fs from '../../util/fs';
import {log} from '../../util/log';
import {getSafe} from '../../util/storeHelper';
import {objDiff, setdefault} from '../../util/util';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import {INI_TWEAKS_PATH} from '../mod_management/InstallManager';
import {IMod} from '../mod_management/types/IMod';
import {IModWithState} from '../mod_management/types/IModProps';
import resolvePath from '../mod_management/util/resolvePath';
import {activeGameId} from '../profile_management/selectors';

import {iniFiles, iniFormat} from './gameSupport';
import renderINITweaks from './TweakList';

import * as Promise from 'bluebird';
import * as path from 'path';
import IniParser, {IniFile, WinapiFormat} from 'vortex-parse-ini';

function ensureIniBackups(gameMode: string, discovery: IDiscoveryResult): Promise<void> {
  return Promise.map(iniFiles(gameMode, discovery), file => {
    const backupFile = file + '.base';
    const bakedFile = file + '.baked';
    return Promise.map([backupFile, bakedFile],
      copy => fs.statAsync(copy)
        .catch(err =>
          fs.copyAsync(file, copy)
            .catch(copyErr => {
              if (copyErr.code === 'ENOENT') {
                log('warn', 'ini file missing', file);
              } else {
                return Promise.reject(copyErr);
              }
            })));
  })
    .then(() => undefined);
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

function discoverSettingsChanges(gameMode: string, discovery: IDiscoveryResult): Promise<void> {
  const format = iniFormat(gameMode);
  if (format === undefined) {
    return Promise.resolve();
  }

  const parser = new IniParser(genIniFormat(format));

  return Promise.map(iniFiles(gameMode, discovery), iniFileName => {
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

function bakeSettings(gameMode: string, discovery: IDiscoveryResult,
                      mods: IMod[], paths: any): Promise<void> {
  const modsPath = resolvePath('install', paths, gameMode);
  const format = iniFormat(gameMode);
  if (format === undefined) {
    return Promise.resolve();
  }

  const enabledTweaks: { [baseFile: string]: string[] } = {};

  const baseFiles = iniFiles(gameMode, discovery);
  const baseFileNames = baseFiles.map(name => path.basename(name).toLowerCase());
  const parser = new IniParser(genIniFormat(format));

  // get a list of all tweaks we need to apply
  return Promise.each(mods, mod => {
    const tweaksPath =
        path.join(modsPath, mod.installationPath, INI_TWEAKS_PATH);
    const modTweaks = getSafe(mod, ['enabledINITweaks'], []).map(name => name.toLowerCase());
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
        .catch(err => {
          if (err.code === 'ENOENT') {
            // source file missing isn't really a big deal, treat as empty
            return Promise.join([
              fs.ensureFileAsync(iniFileName + '.base'),
              fs.ensureFileAsync(iniFileName + '.baked'),
            ]);
          } else {
            return Promise.reject(err);
          }
        })
        .then(() => parser.read(iniFileName + '.baked'))
        .then(ini => Promise.each(enabledTweaks[baseName] || [],
                                  tweak => parser.read(tweak).then(patchIni => {
                                    ini.data = deepMerge(ini.data, patchIni.data);
                                  }))
                         .then(() => parser.write(iniFileName + '.baked', ini))
                         .then(() => fs.copyAsync(iniFileName + '.baked',
                                                  iniFileName)));
  }))
  .then(() => undefined);
}

function purgeChanges(gameMode: string, discovery: IDiscoveryResult) {
  return Promise.map(
      iniFiles(gameMode, discovery),
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
    let deactivated: boolean = false;

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      const state: IState = context.api.store.getState();
      ensureIniBackups(gameMode, state.settings.gameMode.discovered[gameMode])
      .catch(err => {
        deactivated = true;
        if ((err.code === 'EINVAL') && (err.path.toLowerCase().indexOf('onedrive') !== -1)) {
          context.api.showErrorNotification(
            'Failed to create backups of the ini files for this game.',
            'Due to Microsoft using undocumented functionality for the new feature '
            + '"OneDrive Files on Demand" the Node.js framework we use can not currently '
            + 'work correctly on those drives. '
            + `We therefore can't apply ini tweaks to '${err.path}'.\n`
            + 'Please disable this feature and restart Vortex.\n'
            + 'Please keep an eye out on Vortex Changelogs so you know when this is fixed.', {
              allowReport: false,
            });
        } else {
          context.api.showErrorNotification(
            'Failed to create backups of the ini files for this game.',
            {
              Warning:
                'To avoid data loss, ini tweaks are not going to be applied in this session.\n' +
                'Please fix the problem and restart Vortex.',
              Reason: err.message,
            });
        }
      });
    });

    context.api.events.on('bake-settings', (gameId: string, mods: IMod[],
                                            callback: (err: Error) => void) => {
      if (deactivated) {
        return;
      }
      const state: IState = context.api.store.getState();
      const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameId];
      const paths = state.settings.mods.paths;
      discoverSettingsChanges(gameId, discovery)
        .then(() => bakeSettings(gameId, discovery, mods, paths))
        .then(() => callback(null))
        .catch(err => callback(err));
    });

    context.api.events.on('purge-mods', () => {
      if (deactivated) {
        return;
      }
      const state: IState = context.api.store.getState();
      const gameMode = activeGameId(state);
      const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameMode];
      discoverSettingsChanges(gameMode, discovery)
        .then(() => purgeChanges(gameMode, discovery));
    });
  });
}

export default main;
