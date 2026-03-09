/* eslint-disable */
import https from 'https';
import path from 'path';
import _ from 'lodash';
import url from 'url';
import { Builder, parseStringPromise } from 'xml2js';
import semver from 'semver';
import getVersion from 'exe-version';
import { actions, fs, types, log, util } from 'vortex-api';

import { IIncomingGithubHttpHeaders } from './types';

const RELEASE_CUTOFF = '0.6.5';
const GITHUB_URL = 'https://api.github.com/repos/IDCs/WitcherScriptMerger';
const MERGER_RELPATH = 'WitcherScriptMerger';

const MERGER_CONFIG_FILE = 'WitcherScriptMerger.exe.config';

const { getHash, MD5ComparisonError, SCRIPT_MERGER_ID } = require('./common');


function query(baseUrl, request) {
  return new Promise((resolve, reject) => {
    const relUrl = url.parse(`${baseUrl}/${request}`);
    const options = {
      ..._.pick(relUrl, ['port', 'hostname', 'path']),
      headers: {
        'User-Agent': 'Vortex',
      },
    };

    https.get(options, (res) => {
      res.setEncoding('utf-8');
      const headers = res.headers as IIncomingGithubHttpHeaders;
      const callsRemaining = parseInt(headers?.['x-ratelimit-remaining'], 10);
      if ((res.statusCode === 403) && (callsRemaining === 0)) {
        const resetDate = parseInt(headers?.['x-ratelimit-reset'], 10) * 1000;
        log('info', 'GitHub rate limit exceeded',
          { reset_at: (new Date(resetDate)).toString() });
        return reject(new util.ProcessCanceled('GitHub rate limit exceeded'));
      }

      let output = '';
      res
        .on('data', data => output += data)
        .on('end', () => {
          try {
            return resolve(JSON.parse(output));
          } catch (parseErr) {
            return reject(parseErr);
          }
        });
    })
      .on('error', err => {
        return reject(err);
      })
      .end();
  });
}

function getRequestOptions(link) {
  const relUrl = url.parse(link);
  return ({
    ..._.pick(relUrl, ['port', 'hostname', 'path']),
    headers: {
      'User-Agent': 'Vortex',
    },
  });
}

async function downloadConsent(api: types.IExtensionApi) {
  
  return new Promise<void>((resolve, reject) => {
    api.showDialog('info', 'Witcher 3 Script Merger', {
      bbcode: api.translate('Many Witcher 3 mods add or edit game scripts. When several mods ' 
        + 'editing the same script are installed, these mods need to be merged using a tool ' 
        + 'called Witcher 3 Script Merger. Vortex can attempt to download and configure the merger '
        + 'for you automatically - before doing so - please ensure your account has full read/write permissions '
        + 'to your game\'s directory. The script merger can be installed at a later point if you wish. [br][/br][br][/br]'
        + '[url=https://wiki.nexusmods.com/index.php/Tool_Setup:_Witcher_3_Script_Merger]find out more about the script merger.[/url][br][/br][br][/br]' 
        + 'Note: While script merging works well with the vast majority of mods, there is no guarantee for a satisfying outcome in every single case.', { ns: 'game-witcher3' }),
    }, [
      { label: 'Cancel', action: () => reject(new util.UserCanceled()) },
      { label: 'Download', action: () => resolve() },
    ]);
  });
}

async function getMergerVersion(api: types.IExtensionApi) {
  const state = api.store.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', 'witcher3'], undefined);
  if (discovery?.path === undefined) {
    return Promise.reject(new util.SetupError('Witcher3 is not discovered'));
  }
  const merger = discovery?.tools?.W3ScriptMerger;
  if (merger === undefined) {
    return Promise.resolve(undefined);
  }

  if (!!merger?.path) {
    return fs.statAsync(merger.path)
      .then(() => {
        if (merger?.mergerVersion !== undefined) {
          return Promise.resolve(merger.mergerVersion);
        }
        const execVersion = getVersion(merger.path);
        if (!!execVersion) {
          const trimmedVersion = execVersion.split('.').slice(0, 3).join('.');
          const newToolDetails = { ...merger, mergerVersion: trimmedVersion };
          api.store.dispatch(actions.addDiscoveredTool('witcher3', SCRIPT_MERGER_ID, newToolDetails, true));
          return Promise.resolve(trimmedVersion);
        }
      })
      .catch(err => Promise.resolve(undefined));
  } else {
    return Promise.resolve(undefined);
  }
}

let _HASH_CACHE;
async function getCache(api: types.IExtensionApi) {
  if (_HASH_CACHE === undefined) {
    try {
      const data = await fs.readFileAsync(path.join(__dirname, 'MD5Cache.json'), { encoding: 'utf8' });
      _HASH_CACHE = JSON.parse(data);
    } catch (err) {
      // If this ever happens - the user's machine must be screwed.
      //  Maybe virus ? defective hardware ? did he manually manipulate
      //  the file ?
      api.showErrorNotification('Failed to parse MD5Cache', err);
      return _HASH_CACHE = [];
    }
  }

  return _HASH_CACHE;
}

async function onDownloadComplete(api, archivePath, mostRecentVersion) {
  return new Promise(async (resolve, reject) => {
    let archiveHash;
    try {
      archiveHash = await getHash(archivePath);
    } catch (err) {
      return Promise.reject(new MD5ComparisonError('Failed to calculate hash', archivePath));
    }
    const hashCache = await getCache(api);
    if (hashCache.find(entry => (entry.archiveChecksum.toLowerCase() === archiveHash)
                             && (entry.version === mostRecentVersion)) === undefined) {
      // Not a valid hash - something may have happened during the download ?
      return reject(new MD5ComparisonError('Corrupted archive download', archivePath));
    }

    return resolve(archivePath);
  })
  .then((archivePath) => extractScriptMerger(api, archivePath))
  .then(async (mergerPath) => {
    const mergerExec = path.join(mergerPath, 'WitcherScriptMerger.exe');
    let execHash;
    try {
      execHash = await getHash(mergerExec);
    } catch (err) {
      return Promise.reject(new MD5ComparisonError('Failed to calculate hash', mergerExec));
    }
    const hashCache = await getCache(api);
    if (hashCache.find(entry => (entry.execChecksum.toLowerCase() === execHash)
                             && (entry.version === mostRecentVersion)) === undefined) {
      // Not a valid hash - something may have happened during extraction ?
      return Promise.reject(new MD5ComparisonError('Corrupted executable', mergerExec));
    }

    return Promise.resolve(mergerPath);
  })
  .then((mergerPath) => setUpMerger(api, mostRecentVersion, mergerPath))
}

export async function getScriptMergerDir(api, create = false) {
  const state = api.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', 'witcher3'], undefined);
  if (discovery?.path === undefined) {
    return undefined;
  }
  const currentPath = discovery.tools?.W3ScriptMerger?.path;
  try {
    if (!currentPath) {
      throw new Error('Script Merger not set up');
    }
    await fs.statAsync(currentPath);
    return currentPath;
  } catch (err) {
    const defaultPath = path.join(discovery.path, MERGER_RELPATH);
    if (create) {
      await fs.ensureDirWritableAsync(defaultPath);
    }
    return defaultPath;
  }
}

export async function downloadScriptMerger(api: types.IExtensionApi) {
  const state = api.store.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', 'witcher3'], undefined);
  if (discovery?.path === undefined) {
    return Promise.reject(new util.SetupError('Witcher3 is not discovered'));
  }
  let mostRecentVersion;
  const currentlyInstalledVersion = await getMergerVersion(api);
  const downloadNotifId = 'download-script-merger-notif';
  return query(GITHUB_URL, 'releases')
    .then((releases) => {
      if (!Array.isArray(releases)) {
        return Promise.reject(new util.DataInvalid('expected array of github releases'));
      }
      const current = releases
        .filter(rel => semver.valid(rel.name) && semver.gte(rel.name, RELEASE_CUTOFF))
        .sort((lhs, rhs) => semver.compare(rhs.name, lhs.name));

      return Promise.resolve(current);
    })
    .then(async currentRelease => {
      mostRecentVersion = currentRelease[0].name;
      const fileName = currentRelease[0].assets[0].name;
      const downloadLink = currentRelease[0].assets[0].browser_download_url;
      if (!!currentlyInstalledVersion && semver.gte(currentlyInstalledVersion, currentRelease[0].name)) {
        return Promise.reject(new util.ProcessCanceled('Already up to date'));
      }

      const downloadNotif: types.INotification = {
        id: downloadNotifId,
        type: 'activity',
        title: 'Adding Script Merger',
        message: 'This may take a minute...',
      }
      const download = async () => {
        api.sendNotification({
          ...downloadNotif,
          progress: 0,
        });
        let redirectionURL;
        redirectionURL = await new Promise((resolve, reject) => {
          const options = getRequestOptions(downloadLink);
          https.request(options, res => {
            return (res.headers['location'] !== undefined)
              ? resolve(res.headers['location'])
              : reject(new util.ProcessCanceled('Failed to resolve download location'));
          })
            .on('error', err => reject(err))
            .end();
        });
        return new Promise((resolve, reject) => {
          const options = getRequestOptions(redirectionURL);
          https.request(options, res => {
            res.setEncoding('binary');
            const headers = res.headers as IIncomingGithubHttpHeaders;
            const contentLength = parseInt(headers?.['content-length'], 10);
            const callsRemaining = parseInt(headers?.['x-ratelimit-remaining'], 10);
            if ((res.statusCode === 403) && (callsRemaining === 0)) {
              const resetDate = parseInt(headers?.['x-ratelimit-reset'], 10) * 1000;
              log('info', 'GitHub rate limit exceeded',
                { reset_at: (new Date(resetDate)).toString() });
              return reject(new util.ProcessCanceled('GitHub rate limit exceeded'));
            }

            let output = '';
            res
              .on('data', data => {
                output += data
                if (output.length % 500 === 0) {
                  // Updating the notification is EXTREMELY expensive.
                  //  the length % 500 === 0 line ensures this is not done too
                  //  often.
                  api.sendNotification({
                    ...downloadNotif,
                    progress: (output.length / contentLength) * 100,
                  });
                }
              })
              .on('end', () => {
                api.sendNotification({
                  ...downloadNotif,
                  progress: 100,
                });
                api.dismissNotification(downloadNotifId);
                return fs.writeFileAsync(path.join(discovery.path, fileName), output, { encoding: 'binary' })
                  .then(() => resolve(path.join(discovery.path, fileName)))
                  .catch(err => reject(err));
              });
          })
            .on('error', err => reject(err))
            .end();
        });
      }

      if (!!currentlyInstalledVersion || ((currentlyInstalledVersion === undefined) && !!discovery?.tools?.W3ScriptMerger)) {
        api.sendNotification({
          id: 'merger-update',
          type: 'warning',
          noDismiss: true,
          message: api.translate('Important Script Merger update available',
            { ns: 'game-witcher3' }),
          actions: [ { title: 'Download', action: dismiss => {
            dismiss();
            return download()
              .then((archivePath) => onDownloadComplete(api, archivePath, mostRecentVersion))
              .catch(err => {
                api.dismissNotification(extractNotifId);
                api.dismissNotification(downloadNotifId);
                if (err instanceof MD5ComparisonError || err instanceof util.ProcessCanceled) {
                  log('error', 'Failed to automatically install Script Merger', err.errorMessage);
                  api.sendNotification({
                    type: 'error',
                    message: api.translate('Please install Script Merger manually', { ns: 'game-witcher3' }),
                    actions: [
                      { 
                        title: 'Install Manually',
                        action: () => util.opn('https://www.nexusmods.com/witcher3/mods/484')
                              .catch(err => null)
                      }],
                  })
                  return Promise.resolve();
                }
                // Currently AFAIK this would only occur if github is down for any reason
                //  and we were unable to resolve the re-direction link. Given that the user
                //  expects a result from him clicking the download button, we let him know
                //  to try again
                api.sendNotification({
                  type: 'info',
                  message: api.translate('Update failed due temporary network issue - try again later', { ns: 'game-witcher3' }),
                })
                return Promise.resolve();
              })
          } } ],
        });

        return Promise.reject(new util.ProcessCanceled('Update'));
      }

      return downloadConsent(api)
        .then(() => download());
    })
    .then((archivePath) => onDownloadComplete(api, archivePath, mostRecentVersion))
    .catch(async err => {
      const raiseManualInstallNotif = () => {
        log('error', 'Failed to automatically install Script Merger', err.errorMessage);
        api.sendNotification({
          type: 'error',
          message: api.translate('Please install Script Merger manually', { ns: 'game-witcher3' }),
          actions: [
            {
              title: 'Install Manually',
              action: () => util.opn('https://www.nexusmods.com/witcher3/mods/484')
                    .catch(err => null)
            }],
        });
      }
      api.dismissNotification(extractNotifId);
      api.dismissNotification(downloadNotifId);
      if (err instanceof MD5ComparisonError) {
        raiseManualInstallNotif();
        return Promise.resolve();
      }
      if (err instanceof util.UserCanceled) {
        return Promise.resolve();
      } else if (err instanceof util.ProcessCanceled) {
        if ((err.message.startsWith('Already')) || (err.message.startsWith('Update'))) {
          return Promise.resolve();
        } else if (err.message.startsWith('Failed to resolve download location')) {
          // Currently AFAIK this would only occur if github is down for any reason
          //  and we were unable to resolve the re-direction link. Given that this
          //  will most certainly resolve itself eventually - we log this and keep going.
          log('info', 'failed to resolve W3 script merger re-direction link', err);
          return Promise.resolve();
        } else if (err.message.startsWith('Game is not discovered')) {
          raiseManualInstallNotif();
          return Promise.resolve();
        }
      } else {
        return Promise.reject(err);
      }
    })
}

const extractNotifId = 'extracting-script-merger';
const extractNotif = {
  id: extractNotifId,
  type: 'activity',
  title: 'Extracting Script Merger',
}
async function extractScriptMerger(api, archivePath) {
  const destination = await getScriptMergerDir(api, true);
  if (destination === undefined) {
    // How ?
    return Promise.reject(new util.ProcessCanceled('Game is not discovered'));
  }
  const sZip = new util.SevenZip();
  api.sendNotification(extractNotif);
  await sZip.extractFull(archivePath, destination);
  api.sendNotification({
    type: 'info',
    message: api.translate('W3 Script Merger extracted successfully', { ns: 'game-witcher3' }),
  });
  api.dismissNotification(extractNotifId);
  return Promise.resolve(destination);
}

async function setUpMerger(api, mergerVersion, newPath) {
  const state = api.store.getState();
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', 'witcher3'], undefined);
  const currentDetails = discovery?.tools?.W3ScriptMerger;

  const newToolDetails = (!!currentDetails)
    ? { ...currentDetails, mergerVersion }
    : {
      id: SCRIPT_MERGER_ID,
      name: 'W3 Script Merger',
      logo: 'WitcherScriptMerger.jpg',
      executable: () => 'WitcherScriptMerger.exe',
      requiredFiles: [
        'WitcherScriptMerger.exe',
      ],
      mergerVersion,
    };
  newToolDetails.path = path.join(newPath, 'WitcherScriptMerger.exe');
  newToolDetails.workingDirectory = newPath;
  await setMergerConfig(discovery.path, newPath);
  api.store.dispatch(actions.addDiscoveredTool('witcher3', SCRIPT_MERGER_ID, newToolDetails, true));
  return Promise.resolve();
}

export async function getMergedModName(scriptMergerPath) {
  const configFilePath = path.join(scriptMergerPath, MERGER_CONFIG_FILE);
  try {
    const data = await fs.readFileAsync(configFilePath, { encoding: 'utf8' });
    const config = await parseStringPromise(data);
    const configItems = config?.configuration?.appSettings?.[0]?.add;
    const MergedModName = configItems?.find(item => item.$?.key === 'MergedModName') ?? undefined;
    if (!!MergedModName?.$?.value) {
      return MergedModName.$.value;
    }
  } catch (err) {
    // This is probably a sign of a corrupt script merger installation....
    log('error', 'failed to ascertain merged mod name - using "mod0000_MergedFiles"', err);
    return 'mod0000_MergedFiles';
  }
}

export async function setMergerConfig(gameRootPath, scriptMergerPath) {
  const findIndex = (nodes, id) => {
    return nodes?.findIndex(iter => iter.$?.key === id) ?? undefined;
  };

  const configFilePath = path.join(scriptMergerPath, MERGER_CONFIG_FILE);
  try {
    const data = await fs.readFileAsync(configFilePath, { encoding: 'utf8' });
    const config = await parseStringPromise(data);
    const replaceElement = (id, replacement) => {
      const idx = findIndex(config?.configuration?.appSettings?.[0]?.add, id);
      if (idx !== undefined) {
        config.configuration.appSettings[0].add[idx].$ = { key: id, value: replacement };
      }
    };

    replaceElement('GameDirectory', gameRootPath);
    replaceElement('VanillaScriptsDirectory', path.join(gameRootPath, 'content', 'content0', 'scripts'));
    replaceElement('ModsDirectory', path.join(gameRootPath, 'mods'));
    const builder = new Builder();
    const xml = builder.buildObject(config);
    await fs.writeFileAsync(configFilePath, xml);
  } catch (err) {
    // Guess the user will have to set up the merger configuration
    //  through the merger directly.
    return;
  }
}
