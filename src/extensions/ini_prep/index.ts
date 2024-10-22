/* eslint-disable */
import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import { IProfile, IState } from '../../types/IState';
import { ITestResult } from '../../types/ITestResult';
import { UserCanceled } from '../../util/CustomErrors';
import deepMerge from '../../util/deepMerge';
import { disableErrorReport } from '../../util/errorHandling';
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
import { NEXUS_DOMAIN } from '../nexus_integration/constants';
import {activeGameId} from '../profile_management/selectors';

import {iniFiles, iniFormat} from './gameSupport';
import renderINITweaks from './TweakList';

import Promise from 'bluebird';
import { TFunction } from 'i18next';
import * as path from 'path';
import IniParser, { IniFile, WinapiFormat } from 'vortex-parse-ini';

function ensureIniBackups(t: TFunction, gameMode: string,
                          discovery: IDiscoveryResult): Promise<void> {
  return Promise.map(iniFiles(gameMode, discovery), file => {
    const backupFile = file + '.base';
    const bakedFile = file + '.baked';
    return Promise.map([backupFile, bakedFile],
      copy => fs.statAsync(copy)
        .catch(() =>
          fs.copyAsync(file, copy, { noSelfCopy: true })
            .then(() => fs.makeFileWritableAsync(copy))
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

/**
 * updates the .base ini file to reflect changes the user made manually
 */
function discoverSettingsChanges(api: IExtensionApi, gameMode: string,
                                 discovery: IDiscoveryResult): Promise<void> {
  const format = iniFormat(gameMode);
  if (format === undefined) {
    return Promise.resolve();
  }

  const parser = new IniParser(genIniFormat(format));

  const t: TFunction = api.translate;

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
        // don't bother if there was no change
        if (Object.keys(delta).length === 0) {
          return Promise.resolve();
        }
        applyDelta(ini.data, delta);
        return fs.forcePerm(t, () =>
          fs.openAsync(iniFileName + '.base', 'a')
            .then(fd => fs.closeAsync(fd))
            .then(() => parser.write(iniFileName + '.base', ini))
            // Important: Catching errors here means we go on to write the new ini file based
            //   on the old base data, reverting user changes. We should do this only if we know
            //   there are no user changes to keep (e.g. if the ini file had been removed for
            //   some reason). All other errors should be allowed to fail the bake process
            .catch({ code: 'ENOENT' }, err => {
              api.showErrorNotification('Failed to write ini file', err, {
                allowReport: true,
                attachments: [
                  { id: path.basename(iniFileName) + '.base', type: 'data', data: delta,
                    description: 'Ini file' },
                ],
              });
            }));
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

function bakeSettings(t: TFunction,
                      gameMode: string, discovery: IDiscoveryResult,
                      mods: IMod[], state: IState,
                      onApplySettings: ApplySettings): Promise<void> {
  const modsPath = installPathForGame(state, gameMode);
  const format = iniFormat(gameMode);
  if (format === undefined) {
    return Promise.resolve();
  }

  const enabledTweaks: { [baseFile: string]: string[] } = {};

  const baseFiles = iniFiles(gameMode, discovery)
    // got an error report that I can only explain by baseFiles containing undefined
    // but I don't see how that could happen.
    .filter(name => name !== undefined);
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
          return Promise.resolve();
        })
        .catch(err => Promise.resolve(undefined));
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
        .then(() => fs.makeFileWritableAsync(iniFileName + '.baked'))
          // base might not exist, in that case copy from the original ini
          .catch(err => (err.code === 'ENOENT')
            ? fs.copyAsync(iniFileName, iniFileName + '.base', { noSelfCopy: true })
              .then(() => fs.copyAsync(iniFileName, iniFileName + '.baked', { noSelfCopy: true }))
              .then(() => Promise.all([fs.makeFileWritableAsync(iniFileName + '.base'),
                                       fs.makeFileWritableAsync(iniFileName + '.baked')]))
            : Promise.reject(err))))
      .then(() => parser.read(iniFileName + '.baked'))
      .then(ini => Promise.each(enabledTweaks[baseName] || [],
        tweak => parser.read(tweak).then(patchIni => {
          ini.data = deepMerge(ini.data, patchIni.data);
        }))
        .then(() => onApplySettings(iniFileName, ini))
        .then(() => fs.forcePerm(t, () => parser.write(iniFileName + '.baked', ini) as any))
        .then(() => {
          if (iniFileName === undefined) {
            return Promise.reject(new Error(
              `Path is undefined. Game="${gameMode}"; FileList="${baseFiles.join(', ')}"`));
          }
          return fs.copyAsync(iniFileName + '.baked',
                              iniFileName, { noSelfCopy: true });
        }));
  }))
  .then(() => undefined);
}

function purgeChanges(t: TFunction, gameMode: string, discovery: IDiscoveryResult) {
  return Promise.map(
      iniFiles(gameMode, discovery),
      iniFileName =>
          fs.copyAsync(iniFileName + '.base', iniFileName + '.baked', { noSelfCopy: true })
            .then(() => fs.copyAsync(iniFileName + '.base', iniFileName, { noSelfCopy: true })));
}

function testProtectedFolderAccess(): Promise<ITestResult> {
  if (process.platform !== 'win32') {
    // Windows only! (for now)
    return Promise.resolve(undefined);
  }

  let writablePath;
  try {
    // Technically this try/catch block shouldn't be necessary but some users
    //  seem to encounter a crash (Windows only) when attempting to retrieve
    //  the documents path. This may be related to:
    // tslint:disable-next-line:max-line-length
    // https://forums.asp.net/t/1889407.aspx?GetFolderPath+Environment+GetFolderPath+Environment+SpecialFolder+MyDocuments+returning+blank+when+hosted+on+IIS
    writablePath = getVortexPath('documents');
  } catch (err) {
    // We can't retrieve the documents path, but for the purpose of completing this
    //  test, we can simply query a different folder which is also guaranteed to trigger
    //  folder protection functionality.
    // tslint:disable-next-line
    log('error', 'Unable to get path to my documents folder - user environment is misconfigured!', err);
    writablePath = getVortexPath('home');
  }

  const canary = path.join(writablePath, '__vortex_canary.tmp');
  return fs.writeFileAsync(canary, 'Should only exist temporarily, feel free to delete')
    .then(() => fs.removeAsync(canary))
    .then(() => Promise.resolve(undefined))
    .catch(err => {
      // Theoretically the only reason why writing/removing this file would fail is if/when
      //  an external application has blocked Vortex from running the file operation.
      //  in this case it's safe to assume that an AV or possibly Windows Defender
      //  have stepped in and blocked Vortex.
      log('warn', 'reporting AV blocking access to documents',
        { documentsPath: writablePath, error: err.message });
      disableErrorReport();
      return {
        description: {
          short: 'Anti-Virus protection detected',
          long: 'Vortex is being blocked from running file operations by your Anti-Virus software '
          + 'and will not function correctly unless an exception is added manually. <br /><br />'
          + 'Most Anti-Virus applications should inform you of this attempt while others such as '
          + 'Windows 10\'s Windows Defender will block access without prompt.<br /><br />'
          + 'For more information please visit our wiki: '
          + '[url]'
          + `https://wiki.${NEXUS_DOMAIN}/index.php/Configuring_your_anti-virus_to_work_with_Vortex`
          + '[/url]<br /><br />'
          + '[b][color=red]Important: Error reporting from Vortex will be disabled '
          + 'until you remedy this situation.[/color][/b]',
        },
        severity: 'error',
      };
    });
}

function main(context: IExtensionContext) {
  context.registerTableAttribute('mods', {
    id: 'iniEdits',
    description: 'Optional ini modifications',
    calc: () => 'Dummy',
    customRenderer: (mod: IModWithState) => renderINITweaks(mod),
    placement: 'detail',
    edit: {},
  });

  context.registerTest('controlled-folder-access', 'startup',
    () => testProtectedFolderAccess());

  context.once(() => {
    let deactivated: boolean = false;

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      const state: IState = context.api.store.getState();
      ensureIniBackups(context.api.translate, gameMode,
                       state.settings.gameMode.discovered[gameMode])
      .catch(UserCanceled, () => {
        log('warn',
            'User has canceled creation of ini backups. Well, the user is boss I guess...', {
          allowReport: false,
        });
      })
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
              message:
                'To avoid data loss, ini tweaks are not going to be applied in this session.\n' +
                'Please fix the problem and restart Vortex.',
              error: err,
            });
        }
      });
    });

    context.api.onAsync('bake-settings', (gameId: string, mods: IMod[], profile: IProfile) => {
      log('debug', 'baking settings', { gameId, deactivated });
      if (deactivated) {
        return Promise.resolve();
      }
      const state: IState = context.api.store.getState();
      const discovery: IDiscoveryResult = state.settings.gameMode.discovered[profile.gameId];

      if ((discovery === undefined) || (discovery.path === undefined)) {
        return Promise.resolve();
      }

      const onApplySettings = (fileName: string, parser: IniFile<any>): Promise<void> =>
        context.api.emitAndAwait('apply-settings', profile, fileName, parser);

      return discoverSettingsChanges(context.api, profile.gameId, discovery)
        .then(() => bakeSettings(context.api.translate, profile.gameId, discovery,
                                 mods, state, onApplySettings))
        .catch(UserCanceled, () => {
          // nop
          log('info', 'user canceled baking game settings');
        })
        .catch(err => {
          const nonReportable = [362, 1359, 'EBUSY'];
          const allowReport = !(
            err.stack.includes('not enough space on the disk')
            || err.stack.includes('The cloud operation was unsuccessful')
            || nonReportable.includes(err.systemCode)
            || nonReportable.includes(err.errno)
            || nonReportable.includes(err.code)
            );
          context.api.showErrorNotification('Failed to bake settings files', err,
            { allowReport });
        });
    });

    context.api.events.on('purge-mods', () => {
      if (deactivated) {
        return;
      }
      const state: IState = context.api.store.getState();
      const gameMode = activeGameId(state);
      const discovery: IDiscoveryResult = state.settings.gameMode.discovered[gameMode];
      discoverSettingsChanges(context.api, gameMode, discovery)
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
