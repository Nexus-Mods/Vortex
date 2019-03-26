import {IExtensionContext} from '../../types/IExtensionContext';
import { IProfile, IState } from '../../types/IState';
import { ITestResult } from '../../types/ITestResult';
import { UserCanceled } from '../../util/CustomErrors';
import deepMerge from '../../util/deepMerge';
import * as fs from '../../util/fs';
import getVortexPath from '../../util/getVortexPath';
import {log} from '../../util/log';
import { installPathForGame } from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';
import {objDiff, setdefault} from '../../util/util';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import {INI_TWEAKS_PATH} from '../mod_management/InstallManager';
import {IMod} from '../mod_management/types/IMod';
import {IModWithState} from '../mod_management/types/IModProps';
import {activeGameId} from '../profile_management/selectors';

import {iniFiles, iniFormat} from './gameSupport';
import renderINITweaks from './TweakList';

import * as Promise from 'bluebird';
import { TranslationFunction } from 'i18next';
import * as path from 'path';
import IniParser, { IniFile, WinapiFormat } from 'vortex-parse-ini';
import * as winapi from 'winapi-bindings';

import { remote } from 'electron';
import * as os from 'os';

function ensureIniBackups(t: TranslationFunction, gameMode: string,
                          discovery: IDiscoveryResult): Promise<void> {
  return Promise.map(iniFiles(gameMode, discovery), file => {
    const backupFile = file + '.base';
    const bakedFile = file + '.baked';
    return Promise.map([backupFile, bakedFile],
      copy => fs.statAsync(copy)
        .catch(err =>
          fs.copyAsync(file, copy, { noSelfCopy: true })
            .then(() => fs.ensureFileWritableAsync(copy))
            .catch(copyErr => {
              if (copyErr.code === 'ENOENT') {
                log('warn', 'ini file missing', file);
                return Promise.resolve();
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
  if ((typeof(delta) !== 'object') || (delta === null)) {
    return;
  }

  Object.keys(delta).forEach(key => {
    if (key[0] === '-') {
      delete data[key.slice(1)];
    } else if (key[0] === '+') {
      data[key.slice(1)] = delta[key];
    } else {
      if (data[key] === undefined) {
        data[key] = {};
      }
      applyDelta(data[key], delta[key]);
    }
  });
}

function discoverSettingsChanges(t: TranslationFunction, gameMode: string,
                                 discovery: IDiscoveryResult): Promise<void> {
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
        return fs.forcePerm(t, () => parser.write(iniFileName + '.base', ini));
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

type ApplySettings = (fileName: string, parser: IniFile<any>) => Promise<void>;

function bakeSettings(t: TranslationFunction,
                      gameMode: string, discovery: IDiscoveryResult,
                      mods: IMod[], state: IState,
                      onApplySettings: ApplySettings): Promise<void> {
  const modsPath = installPathForGame(state, gameMode);
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
    if (mod.installationPath === undefined) {
      return Promise.resolve();
    }
    const tweaksPath = path.join(modsPath, mod.installationPath, INI_TWEAKS_PATH);
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
  }).then(() => Promise.mapSeries(baseFiles, iniFileName => {
    // starting with the .base file for each ini, re-bake the file by applying
    // the ini tweaks
    const baseName = path.basename(iniFileName).toLowerCase();
    // ensure the original ini and directory up to it exists
    return fs.ensureFileAsync(iniFileName)
      .then(() => fs.unlinkAsync(iniFileName + '.baked')
        .catch(err => (err.code === 'ENOENT')
          ? Promise.resolve()
          : Promise.reject(err))
        .then(() => fs.copyAsync(iniFileName + '.base', iniFileName + '.baked',
                                 { noSelfCopy: true })
        .then(() => fs.ensureFileWritableAsync(iniFileName + '.baked'))
          // base might not exist, in that case copy from the original ini
          .catch(err => (err.code === 'ENOENT')
            ? fs.copyAsync(iniFileName, iniFileName + '.base')
              .then(() => fs.copyAsync(iniFileName, iniFileName + '.baked', { noSelfCopy: true }))
              .then(() => Promise.all([fs.ensureFileWritableAsync(iniFileName + '.base'),
                                       fs.ensureFileWritableAsync(iniFileName + '.baked')]))
            : Promise.reject(err))))
      .then(() => parser.read(iniFileName + '.baked'))
      .then(ini => Promise.each(enabledTweaks[baseName] || [],
        tweak => parser.read(tweak).then(patchIni => {
          ini.data = deepMerge(ini.data, patchIni.data);
        }))
        .then(() => onApplySettings(iniFileName, ini))
        .then(() => fs.forcePerm(t, () => parser.write(iniFileName + '.baked', ini)))
        .then(() => fs.copyAsync(iniFileName + '.baked',
          iniFileName, { noSelfCopy: true })));
  }))
  .then(() => undefined);
}

function purgeChanges(t: TranslationFunction, gameMode: string, discovery: IDiscoveryResult) {
  return Promise.map(
      iniFiles(gameMode, discovery),
      iniFileName =>
          fs.copyAsync(iniFileName + '.base', iniFileName + '.baked', { noSelfCopy: true })
            .then(() => fs.copyAsync(iniFileName + '.base', iniFileName, { noSelfCopy: true })));
}

function testControlledFolderAccess(): Promise<ITestResult> {
  if ((process.platform !== 'win32') || (os.release().substr(0, 2) !== '10')) {
    // This is a windows 10 only check.
    return Promise.resolve(undefined);
  }

  try {
    const controlledFolderAccessEnabled = winapi.RegGetValue(
      'HKEY_LOCAL_MACHINE',
      // tslint:disable-next-line: max-line-length
      'SOFTWARE\\Microsoft\\Windows Defender\\Windows Defender Exploit Guard\\Controlled Folder Access',
      'EnableControlledFolderAccess');
    if (!controlledFolderAccessEnabled || (controlledFolderAccessEnabled.type !== 'REG_DWORD')) {
      // The registry value doesn't exist, or we got back an unexpected type.
      //  This shouldn't happen....
      const addendum = (controlledFolderAccessEnabled !== undefined)
        ? `Unexpected type: ${controlledFolderAccessEnabled.type}`
        : 'Missing key';
      log('warn', 'Unable to ascertain the status of Microsoft\'s '
                + 'controlled folder access feature', addendum);
      return Promise.resolve(undefined);
    } else {
      // Check if Vortex has already been excluded.
      let isVortexExcluded = false;
      const currentAppPath = (remote.app !== undefined)
        ? remote.app.getPath('exe').toLowerCase()
        : path.join(getVortexPath('base').toLowerCase(), 'vortex.exe');
      winapi.WithRegOpen('HKEY_LOCAL_MACHINE',
        // tslint:disable-next-line: max-line-length
        'SOFTWARE\\Microsoft\\Windows Defender\\Windows Defender Exploit Guard\\Controlled Folder Access\\AllowedApplications',
        (hkey: Buffer) => {
          isVortexExcluded = winapi.RegEnumValues(hkey).find(value =>
            (value.key.toLowerCase() === currentAppPath)) !== undefined;
        });
      if ((controlledFolderAccessEnabled.value === 0) || isVortexExcluded) {
        return Promise.resolve(undefined);
      }
    }
  } catch (err) {
    // Something went wrong with the native code...
    //  We log this and resolve.
    if (err.errno === 2) {
      // This is a valid scenario if the user had not updated his Windows copy for a while.
      //  CFA was added as part of the Windows 10 version 1709 Fall Creators Update.
      log('info', 'Winapi unable to retrieve controlled folder access status', err);
    } else {
      log('warn', 'Winapi unable to retrieve controlled folder access status', err);
    }
    return Promise.resolve(undefined);
  }

  const result: ITestResult = {
    description: {
      short: 'Controlled folder access detected',
      long: 'Microsoft\'s Windows Defender application provides its users with a ransomware '
        + 'protection service called "Controlled Folder Access". This service blocks applications '
        + 'from making changes to certain protected paths such as My Documents, Downloads, '
        + 'etc.<br/><br />'
        + 'In order to function correctly, Vortex requires access to these protected paths and '
        + 'therefore requires you to manually add an exception for Vortex. To do this:<br />'
        + '1. Click the start button and type-in for "Windows Defender Settings" and open it.<br />'
        + '2. Click on "Virus & threat protection".<br />'
        + '3. Click on "Ransomware protection".<br />'
        + '4. Select "Allow an app through Controlled folder access".<br />'
        + '5. Finally, click on "Add an allowed app" and browse to Vortex\'s executable file '
        + 'which by default can be found in '
        + '"C:\\Program Files\\Black Tree Gaming Ltd\\Vortex\\Vortex.exe"<br /><br />'
        + 'For a more in-depth guide please view: '
        + '[url]https://wiki.nexusmods.com/index.php/Controlled_Folder_Access[/url]',
    },
    severity: 'error',
  };

  return Promise.resolve(result);
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

  context.registerTest('controlled-folder-access', 'startup',
    () => testControlledFolderAccess());

  context.once(() => {
    let deactivated: boolean = false;

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      const state: IState = context.api.store.getState();
      ensureIniBackups(context.api.translate, gameMode,
                       state.settings.gameMode.discovered[gameMode])
      .catch(err => {
        deactivated = true;
        if ((err.code === 'EINVAL') && (err.path.toLowerCase().indexOf('onedrive') !== -1)) {
          context.api.showErrorNotification(
            'Failed to create backups of the ini files for this game.',
            'Due to Microsoft using undocumented functionality for the new feature '
            + '"OneDrive Files on Demand" the Node.js framework we use can not currently '
            + 'work correctly on those drives. '
            + `We therefore can't apply ini tweaks to '{{ filePath }}'.\n`
            + 'Please disable this feature and restart Vortex.\n'
            + 'Please keep an eye out on Vortex Changelogs so you know when this is fixed.', {
              allowReport: false,
              replace: { filePath: err.path },
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

    context.api.onAsync('bake-settings', (gameId: string, mods: IMod[], profile: IProfile) => {
      log('debug', 'baking settings', { gameId, deactivated });
      if (deactivated) {
        return;
      }
      const state: IState = context.api.store.getState();
      const discovery: IDiscoveryResult = state.settings.gameMode.discovered[profile.gameId];

      const onApplySettings = (fileName: string, parser: IniFile<any>): Promise<void> =>
        context.api.emitAndAwait('apply-settings', profile, fileName, parser);

      return discoverSettingsChanges(context.api.translate, profile.gameId, discovery)
        .then(() => bakeSettings(context.api.translate, profile.gameId, discovery,
                                 mods, state, onApplySettings))
        .catch(UserCanceled, () => {
          // nop
          log('info', 'user canceled baking game settings');
        })
        .catch(err => {
          context.api.showErrorNotification('Failed to bake settings files', err,
            { allowReport: (err.stack.indexOf('not enough space on the disk') === -1) });
        });
    });

    context.api.events.on('purge-mods', () => {
      if (deactivated) {
        return;
      }
      const state: IState = context.api.store.getState();
      const gameMode = activeGameId(state);
      const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameMode];
      discoverSettingsChanges(context.api.translate, gameMode, discovery)
        .then(() => purgeChanges(context.api.translate, gameMode, discovery))
        .catch(UserCanceled, () => {
          context.api.showErrorNotification('Ini files were not restored',
                                            undefined, { allowReport: false });
        })
        .catch(err => {
          context.api.showErrorNotification('Failed to purge ini edits', err,
                                            { allowReport: (err as any).code !== 'ENOENT' });
        });
    });
  });
}

export default main;
