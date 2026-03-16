/* eslint-disable */
import path from 'path';

import { fs, types, util } from 'vortex-api';

const { clipboard } = require('electron');

/**
 * SMAPI log display helpers.
 *
 * This module owns the "SMAPI Log" UI action flow:
 * - locate crash/latest log files in the Vortex app data directory
 * - show log content in a dialog
 * - support one-click copy + open of https://smapi.io/log
 */
async function showSMAPILog(api: types.IExtensionApi, basePath: string, logFile: string) {
  const logData = await fs.readFileAsync(path.join(basePath, logFile), { encoding: 'utf-8' });
  if (api.showDialog === undefined) {
    return;
  }
  await api.showDialog('info', 'SMAPI Log', {
    text: 'Your SMAPI log is displayed below. To share it, click "Copy & Share" which will copy it to your clipboard and open the SMAPI log sharing website. '
      + 'Next, paste your code into the text box and press "save & parse log". You can now share a link to this page with others so they can see your log file.\n\n'
      + logData,
  }, [{
    label: 'Copy & Share log',
    action: () => {
      const timestamp = new Date().toISOString().replace(/^.+T([^\.]+).+/, '$1');
      clipboard.writeText(`[${timestamp} INFO Vortex] Log exported by Vortex ${util.getApplication().version}.\n` + logData);
      return util.opn('https://smapi.io/log').catch(() => undefined);
    },
  }, {
    label: 'Close',
    action: () => undefined,
  }]);
}

export async function onShowSMAPILog(api: types.IExtensionApi) {
  const basePath = path.join(util.getVortexPath('appData'), 'stardewvalley', 'errorlogs');
  try {
    await showSMAPILog(api, basePath, 'SMAPI-crash.txt');
  } catch (err) {
    try {
      await showSMAPILog(api, basePath, 'SMAPI-latest.txt');
    } catch (innerErr) {
      api.sendNotification?.({
        type: 'info',
        title: 'No SMAPI logs found.',
        message: '',
        displayMS: 5000,
      });
    }
  }
}
