import * as semver from 'semver';
import { actions, fs, types, util } from 'vortex-api';
import { importModSettingsGame } from './loadOrder';
import path from 'path';

import { getActivePlayerProfile, logDebug, profilesPath } from './util';
import { setBG3ExtensionVersion } from './actions';
import { DEBUG } from './common';

export async function migrate(api: types.IExtensionApi): Promise<void> {
  const bg3ProfileId = await getActivePlayerProfile(api);
  const settingsPath: string = path.join(profilesPath(), bg3ProfileId, 'modsettings.lsx');
  const backupPath = settingsPath + '.backup';
  const currentVersion = util.getSafe(api.getState(), ['settings', 'baldursgate3', 'extensionVersion'], '0.0.0');

  try {
    await fs.statAsync(backupPath); // if it doesn't exist, make a backup
  } 
  catch (err) {

    logDebug(`${backupPath} doesn't exist.`);

    try {
      await fs.statAsync(settingsPath); 
      await fs.copyAsync(settingsPath, backupPath, { overwrite: true } );
      
      logDebug(`backup created`);
      
      // import
      await importModSettingsGame(api);
      
      //logDebug(`${backupPath} doesn't exist`);
    } 
    catch (err) {
      logDebug(`${settingsPath} doesn't exist`);
    }    
  } finally {
    await migrate15(api, currentVersion);
  }

  // back up made just in case
}

export async function migrate15(api: types.IExtensionApi, oldVersion: string): Promise<void> {

  const newVersion = '1.5.0';

  // if old version is newer, then skip
  if (!DEBUG && semver.gte(oldVersion, newVersion)) {
    logDebug('skipping migration');
    return Promise.resolve();
  }

  await importModSettingsGame(api);
  const t = api.translate;
  const batched: any = [setBG3ExtensionVersion(newVersion)];
  api.sendNotification({
    id: 'bg3-patch7-info',
    type: 'info',
    message: 'Baldur\'s Gate 3 patch 7',
    allowSuppress: true,
    actions: [{
      title: 'More',
      action: (dismiss) => {
        api.showDialog('info', 'Baldur\'s Gate 3 patch 7', {
          bbcode: t('As of Baldur\'s Gate 3 patch 7, the "ModFixer" mod is no longer required. Please feel free to disable it.{{bl}}'
                  + 'Additional information about patch 7 troubleshooting can be found here: [url]{{url}}[/url]{{bl}}'
                  + 'Please note - if you switch between different game versions/patches - make sure to purge your mods and run the game at least once '
                  + 'so that the game can regenerate your "modsettings.lsx" file.', { replace: {
            bl: '[br][/br][br][/br]',
            url: 'https://wiki.bg3.community/en/Tutorials/patch7-troubleshooting',
          } }),
        }, [ { label: 'Close', action: () => {
          batched.push(actions.suppressNotification('bg3-patch7-info', true));
          dismiss();
        }}]);
      }
    }],
  })
  util.batchDispatch(api.store, batched);
}

export async function migrate13(api: types.IExtensionApi, oldVersion: string): Promise<void> {

  const newVersion = '1.4.0'; // FORCING MIGRATION

  // if old version is newer, then skip
  if (semver.gte(oldVersion, newVersion)) {
    logDebug('skipping migration');
    return Promise.reject();
  }

  logDebug('perform migration');

  // do we just a force a import from game?!

  try {
    await importModSettingsGame(api);
    return Promise.reject(); // FORCE NOT RECORD VERSION NUMBER
  } 
  catch {
    return Promise.reject();
  }

  return Promise.reject();  
}
