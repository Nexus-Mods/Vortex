import * as path from 'path';
import * as React from 'react';
import * as url from 'url';
import { actions, fs, log, selectors, tooltip, types, util } from 'vortex-api';

import BooleanFilter from './BooleanFilter';

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * ONE_MINUTE;

// Based on information from
// https://github.com/ModOrganizer2/modorganizer-script_extender_plugin_checker
// by Silarn.
const compatibleGames = {
  skyrim: [
    path.join(util.getVortexPath('documents'), 'My Games', 'Skyrim', 'SKSE', 'skse.log'),
  ],
  skyrimse: [
    path.join(util.getVortexPath('documents'), 'My Games', 'Skyrim Special Edition', 'SKSE', 'skse64.log'),
  ],
  skyrimvr: [
    path.join(util.getVortexPath('documents'), 'My Games', 'Skyrim VR', 'SKSE', 'sksevr.log'),
  ],
  enderal: [
    path.join(util.getVortexPath('documents'), 'My Games', 'Skyrim', 'SKSE', 'skse.log'),
  ],
  fallout4: [
    path.join(util.getVortexPath('documents'), 'My Games', 'Fallout 4', 'F4SE', 'f4se.log'),
  ],
  oblivion: [
    path.join('{GamePath}', 'obse.log'),
    path.join('{GamePath}', 'obse_editor.log'),
  ],
  falloutnv: [
    path.join('{GamePath}', 'nvse.log'),
    path.join('{GamePath}', 'nvse_editor.log'),
  ],
  fallout3: [
    path.join('{GamePath}', 'fose.log'),
    path.join('{GamePath}', 'fose_editor.log'),
  ],
};

let errorState: { [modId: string]: IErrorLine } = util.makeReactive({});
let errorStateChange: () => void;

interface IErrorLog {
  errLogFile: string;
  errLogTime: number;
  errors: IErrorLine[];
}

interface IErrorLine {
  dllName: string;
  modId?: string;
  message: string;
}

function getModId(manifest: any, modLookup: { [modPath: string]: string }, dllName: string) {
  if (manifest === undefined) {
    return undefined;
  }

  const dllNameNorm = path.join('skse', 'plugins', dllName).toLowerCase();
  const deployedFile = manifest.files
    .find(file => file.relPath.toLowerCase() === dllNameNorm);
  if (deployedFile !== undefined) {
    return modLookup[deployedFile.source];
  }

  return undefined;
}

async function checkForErrors(api: types.IExtensionApi) {
  const state: types.IState = api.store.getState();
  const gameDiscovery = selectors.currentGameDiscovery(state);
  if ((gameDiscovery === undefined) || (gameDiscovery.path === undefined)) {
    return false;
  }
  const gamePath = gameDiscovery.path;
  const gameMode = selectors.activeGameId(state);

  const logPaths: string[] = compatibleGames[gameMode];

  if (!logPaths) {
    log('debug', 'game doesn\'t use a script extender', gameMode);
    return false;
  }

  const errorInstances: IErrorLog[] = [];

  await Promise.all(logPaths.map(async (filePath) => {
    const errors: IErrorLine[] = [];
    let errLogFile: string;
    let errLogTime: number = 0;

    // Replace {GamePath} if it's not a full path.
    filePath = filePath.replace('{GamePath}', gamePath);

    try {
      const logTime = (await fs.statAsync(filePath)).mtime.getTime();

      // Was this log generated since the user tried to start the game?
      if (Math.round(logTime / 1000) > launchTime) {
        const logFile = await fs.readFileAsync(filePath, { encoding: 'utf8' });
        errors.push(...parseSELog(logFile));
        if ((errLogTime === undefined) || (logTime > errLogTime)) {
          errLogTime = Math.max(errLogTime, logTime);
          errLogFile = filePath;
        }

        if (errors.length > 0) {
          errorInstances.push({ errLogFile, errLogTime, errors });
        }
      } else {
        log('debug', 'Script extender log file was not updated this session.');
      }
    } catch (err) {
      log(err.code === 'ENOENT' ? 'info' : 'error',
        'Failed to check for script extender errors', err.message);
    }
  }));

  if (errorInstances.length > 0) {
    let manifest;
    try {
      manifest = await util.getManifest(api);
    } catch (err) {
      // We found script extender errors but we can't seem to
      //  retrieve the manifest file - I suppose that's plausible
      //  if the file has been removed. We log as info or error
      //  depending on whether it's our responsibility to fix it.
      const isNonActionable = ['ENOENT', 'EIO', 'EPERM'].indexOf(err.code) !== -1;
      log(isNonActionable ? 'info' : 'error',
        'Failed to retrieve manifest information', err.message);
      return false;
    }

    const errors = errorInstances.reduce((accum, iter) => {
      accum = [].concat(accum, iter.errors);
      return accum;
    }, []);

    const mods = state.persistent.mods[gameMode] || {};
    const modLookup: { [modPath: string]: string } = Object.keys(mods).reduce((prev, modId) => {
      prev[mods[modId].installationPath] = modId;
      return prev;
    }, {});

    errors.forEach(iter => {
      iter.modId = getModId(manifest, modLookup, iter.dllName);
    });

    errorState = errors.reduce((prev, err) => {
      prev[err.modId] = err;
      return prev;
    }, {});
    if (errorStateChange !== undefined) {
      errorStateChange();
    }

    const renderError = input => {
      const modName = (input.modId !== undefined) && (mods[input.modId] !== undefined)
        ? util.renderModName(mods[input.modId])
        : api.translate('<manually installed>');
      return `- "${input.dllName}" (${modName}): ${api.translate(input.message)}`;
    };

    const buildLogErrorString = (errLog: IErrorLog): string => {
      const logTime = new Date(errLog.errLogTime);
      return api.translate('[url={{logPathURI}}]{{logPath}}[/url] {{pathSep}} [url={{logURI}}]{{logName}}[/url]<br/>'
          + (((Date.now() - logTime.getTime()) > ONE_HOUR)
            ? '[color=red]Reported {{logTime}}.[/color]<br/><br/>'
            : 'Reported {{logTime}}.<br/><br/>'), { replace: {
              logPath: path.dirname(errLog.errLogFile),
              logName: path.basename(errLog.errLogFile),
              logPathURI: url.pathToFileURL(path.dirname(errLog.errLogFile)),
              logURI: url.pathToFileURL(errLog.errLogFile),
              pathSep: path.sep,
              logTime: util.relativeTime(logTime, api.translate),
            }});
    };
    api.sendNotification({
      id: 'script-extender-errors',
      type: 'warning',
      message: 'Script extender plugin errors detected',
      noDismiss: true,
      actions: [
        {
          title: 'More', action: () =>
            api.showDialog('info', 'Script extender plugin errors', {
              bbcode: api.translate('Last time you ran the game or Creation kit, one or more script extender '
                + 'plugins failed to load; this is according to:<br/>'
                + '{{errorInformation}}'
                + 'This normally happens when you try to load mods which are not compatible with '
                + 'the installed version of the script extender.<br/>'
                + 'To fix this problem you can check for an update on the mod page of the failed '
                + 'plugin or disable the mod until it is updated.<br/><br/>'
                + 'Error(s) reported:'
                + '<br/>', {
                  replace: {
                    errorInformation: errorInstances.map(buildLogErrorString),
                  },
                }) + errors.map(renderError).join('<br/>'),
              options: {
                bbcodeContext: {
                  allowLocal: true,
                },
              }
            }, [{ label: 'Ignore', action: () => {
              // Ignoring will set the launch time to now and dismiss the active notifications.
              api.dismissNotification('script-extender-errors');
              launchTime = Math.round(Date.now() / 1000);
            } }, { label: 'Close' }]),
        },
        {
          title: 'Dismiss', action: dismiss => {
            api.store.dispatch(
              actions.setAttributeVisible('mods', 'script-extender-error-check', false));
            dismiss();
          },
        },
      ],
    });
  }
  return errorInstances.length > 0;
}

const loadStatusMessages = [
    'reported as incompatible during query',
    'reported as incompatible during load',
    'disabled, fatal error occurred while loading plugin',
    'disabled, no name specified',
    'disabled, fatal error occurred while checking plugin compatibility',
    'disabled, fatal error occurred while querying plugin',
];

function messageFromCode(input: number): string {
  switch (input) {
    case 126: return 'dependent dll not found (code 126)';
    case 193: return 'not a valid dll (code 193)';
    default: return `error code ${input}`;
  }
}

function parseSELog(input: string) {
  const errorArray: IErrorLine[] = [];
  const lines: string[] = input.split(/\r*\n/);

  lines.forEach(line => {
    const message = loadStatusMessages.find(iter => line.indexOf(iter) !== -1);
    if (message !== undefined) {
      // matched lines look like this:
      // tslint:disable-next-line:max-line-length
      // plugin E:\SteamLibrary\steamapps\common\Skyrim Special Edition\Data\SKSE\Plugins\\Fuz Ro D'oh.dll (00000001 Fuz Ro D'oh 010513CC) reported as incompatible during query
      // we want to extract the file name

      const pluginPath = line.replace(/.*plugin (.:.*\.dll) \(.*/, '$1');
      if (pluginPath === line) {
        log('warn', 'failed to parse script extender output', line);
        return;
      }
      const dllName = path.basename(pluginPath);

      errorArray.push({ dllName, message });
    } else {
      const match = line.match(/couldn't load plugin (.*) \(Error (\d*)\)/);
      if (match !== null) {
        const dllName = path.basename(match[1]);
        errorArray.push({ dllName, message: messageFromCode(parseInt(match[2], 10)) });
      }
    }
  });

  return errorArray;
}

let launchTime = 0;

function main(context: types.IExtensionContext) {
  context.requireVersion('>=1.0.4');

  context.registerTableAttribute('mods', {
    id: 'script-extender-error-check',
    name: 'Extender Error',
    placement: 'table',
    condition: () => {
      const state: types.IState = context.api.store.getState();
      const gameMode = selectors.activeGameId(state);
      return compatibleGames[gameMode] !== undefined;
    },
    customRenderer: (mod) => {
      const err = errorState[mod.id];
      return (err === undefined)
        ? null
        : React.createElement(tooltip.Icon, { name: 'feedback-warning', tooltip: err.message });
    },
    calc: (mod) => errorState[mod.id] !== undefined,
    isToggleable: false,
    filter: new BooleanFilter(),
    edit: {},
    isDefaultVisible: false,
    externalData: (onChange: () => void) => errorStateChange = onChange,
  });

  context.once(() => {
    context.api.setStylesheet('script-extender-error-check', path.join(__dirname, 'style.scss'));

    // let launchTime = 0;

    context.api.events.on('gamemode-activated', async () => {
      // Clear any outstanding notifications (they'll come back if we switch back to this game)
      context.api.dismissNotification('script-extender-errors');
      const hasErrors = await checkForErrors(context.api);
      context.api.store.dispatch(
        actions.setAttributeVisible('mods', 'script-extender-error-check', hasErrors));
    });

    context.api.onStateChange(['session', 'base', 'toolsRunning'], async (previous, current) => {
      if ((Object.keys(previous).length === 0) && (Object.keys(current).length > 0)) {
        launchTime = Math.round(Date.now() / 1000);
      }
      if ((Object.keys(previous).length > 0) && (Object.keys(current).length === 0)) {
        const hasErrors = await checkForErrors(context.api);
        context.api.store.dispatch(
          actions.setAttributeVisible('mods', 'script-extender-error-check', hasErrors));
      }
    });
  });
}

export default main;
