import { setDownloadModInfo } from '../../actions';
import { IDialogResult, showDialog } from '../../actions/notifications';
import { IExtensionApi, IExtensionContext, ILookupResult } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { DataInvalid, HTTPError, ProcessCanceled,
         ServiceTemporarilyUnavailable, UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import * as fs from '../../util/fs';
import LazyComponent from '../../util/LazyComponent';
import { log } from '../../util/log';
import { showError, prettifyNodeErrorMessage } from '../../util/message';
import opn from '../../util/opn';
import { activeGameId, downloadPathForGame, gameById, knownGames } from '../../util/selectors';
import { currentGame, getSafe } from '../../util/storeHelper';
import { decodeHTML, truthy } from '../../util/util';

import { ICategoryDictionary } from '../category_management/types/ICategoryDictionary';
import { DownloadIsHTML } from '../download_management/DownloadManager';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { IMod } from '../mod_management/types/IMod';

import { IResolvedURL } from '../download_management';
import { DownloadState } from '../download_management/types/IDownload';

import { setUserAPIKey } from './actions/account';
import { setNewestVersion } from './actions/persistent';
import { setLoginId, setLoginError } from './actions/session';
import { setAssociatedWithNXMURLs } from './actions/settings';
import { accountReducer } from './reducers/account';
import { persistentReducer } from './reducers/persistent';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';
import { convertNXMIdReverse, nexusGameId } from './util/convertGameId';
import retrieveCategoryList from './util/retrieveCategories';
import { getPageURL } from './util/sso';
import DashboardBanner from './views/DashboardBanner';
import GoPremiumDashlet from './views/GoPremiumDashlet';
import LoginDialog from './views/LoginDialog';
import LoginIcon from './views/LoginIcon';
import { } from './views/Settings';

import { genEndorsedAttribute, genGameAttribute, genModIdAttribute } from './attributes';
import * as eh from './eventHandlers';
import NXMUrl from './NXMUrl';
import * as sel from './selectors';
import { endorseModImpl, nexusGames, processErrorMessage, startDownload, updateKey } from './util';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fuzz from 'fuzzball';
import I18next from 'i18next';
import NexusT, { IDownloadURL, NexusError, RateLimitError, TimeoutError } from 'nexus-api';
import * as path from 'path';
import * as React from 'react';
import { Button } from 'react-bootstrap';
import {} from 'uuid';
import * as WebSocket from 'ws';
const app = remote !== undefined ? remote.app : appIn;

let nexus: NexusT;

export class APIDisabled extends Error {
  constructor() {
    super('Network functionality disabled');
    this.name = this.constructor.name;
  }
}

// functions in the nexus api that don't trigger requests but instead are
// management functions to control the our api connection
const mgmtFuncs = new Set(['setGame', 'getValidationResult', 'getRateLimits']);

class Disableable {
  private mDisabled = false;
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  get(obj, prop) {
    if (prop === 'disable') {
      return () => this.mDisabled = true;
    } else if ((!this.mDisabled)
               || mgmtFuncs.has(prop)
               || (typeof obj[prop] !== 'function')) {
      if (prop === 'getFileByMD5') {
        return (hash: string, gameId: string) => {
          if (gameId.toLowerCase() === 'skyrimse') {
            this.mApi.showErrorNotification('Attempt to send invalid API request, please report this (once)',
              new Error(`getFileByMD5 called with game id ${gameId}`), { id: 'api-invalid-gameid' });
            gameId = 'skyrimspecialedition';
          }
          return obj[prop](hash, gameId);
        }
      }
      return obj[prop];
    } else {
      return () => Promise.reject(new APIDisabled());
    }
  }
};

function getCaller() {
  // save original values
  const origLimit = Error.stackTraceLimit;
  const origHandler = Error.prepareStackTrace;

  // set up error to return the vanilla v8 stack trace
  const dummyObject: { stack?: any } = {};
  Error.stackTraceLimit = Infinity;
  Error.prepareStackTrace = (dummyObject, v8StackTrace) => v8StackTrace;
  Error.captureStackTrace(dummyObject, getCaller);
  const v8StackTrace = dummyObject.stack;

  // restore original values
  Error.prepareStackTrace = origHandler;
  Error.stackTraceLimit = origLimit;

  return v8StackTrace;
}

function framePos(frame: any) {
  return `${frame.getFileName()}:${frame.getLineNumber()}:${frame.getColumnNumber()}`;
}

const requestLog = {
  requests: [],
  logPath: path.join(app.getPath('userData'), 'network.log'),
  debouncer: new Debouncer(() => {
    // TODO: why does "this" not point to the right object here?
    const reqs = requestLog.requests;
    requestLog.requests = [];
    return fs.writeFileAsync(requestLog.logPath, reqs.join('\n') + '\n', { flag: 'a' })
  }, 500),
  log(prop: string, args: any[], caller: string) {
    this.requests.push(`success - (${Date.now()}) ${prop} (${args.join(', ')}) from ${caller}`);
    this.debouncer.schedule();
  },
  logErr(prop: string, args: any[], caller: string, err: Error) {
    this.requests.push(`failed - (${Date.now()}) ${prop} (${args.join(', ')}) from ${caller}: ${err.message}`);
    this.debouncer.schedule();
  },
  get(obj, prop) {
    if (mgmtFuncs.has(prop)
        || (typeof obj[prop] !== 'function')) {
          return obj[prop];
    } else {
      return (...args) => {
        const prom = obj[prop](...args);
        if (prom.then !== undefined) {
          const stack = getCaller();
          let caller = stack[1].getFunctionName();
          if (caller === null) {
            caller = framePos(stack[1]);
          }
          return prom.then(res => {
            if (prop === 'setKey') {
              // don't log sensitive data
              this.log(prop, [], caller);
            } else {
              this.log(prop, args || [], caller);
            }
            return Promise.resolve(res);
          })
          .catch(err => {
            if (prop === 'setKey') {
              // don't log sensitive data
              this.logErr(prop, [], caller, err);
            } else {
              this.logErr(prop, args || [], caller, err);
            }
            err.stack += '\n\nCalled from:\n\n'
              + stack.map(frame =>
                `  at ${frame.getFunctionName()} (${framePos(frame)})`)
                .join('\n');
            return Promise.reject(err);
          })
        } else {
          return prom;
        }
      };
    }
  }
}

export interface IExtensionContextExt extends IExtensionContext {
  registerDownloadProtocol: (
    schema: string,
    handler: (inputUrl: string) => Promise<{ urls: string[], meta: any }>) => void;
}

function retrieveCategories(api: IExtensionApi, isUpdate: boolean) {
  let askUser: Promise<boolean>;
  if (isUpdate) {
    askUser = api.store.dispatch(
      showDialog('question', 'Retrieve Categories', {
        text: 'Clicking RETRIEVE you will lose all your changes',
      }, [ { label: 'Cancel' }, { label: 'Retrieve' } ]))
      .then((result: IDialogResult) => {
        return result.action === 'Retrieve';
      });
  } else {
    askUser = Promise.resolve(true);
  }

  askUser.then((userContinue: boolean) => {
    if (!userContinue) {
      return;
    }

    const APIKEY = getSafe(api.store.getState(),
      ['confidential', 'account', 'nexus', 'APIKey'], '');
    if (!truthy(APIKEY)) {
      showError(api.store.dispatch,
        'An error occurred retrieving categories',
        'You are not logged in to Nexus Mods!', { allowReport: false });
    } else {
      let gameId;
      currentGame(api.store)
        .then((game: IGameStored) => {
          gameId = game.id;
          const nexusId = nexusGameId(game);
          if (nexusGames().find(ngame => ngame.domain_name === nexusId) === undefined) {
            // for all we know there could be another extension providing categories for this game
            // so we can't really display an error message or anything
            log('debug', 'game unknown on nexus', { gameId: nexusId });
            return Promise.reject(new ProcessCanceled('unsupported game'));
          }
          log('info', 'retrieve categories for game', gameId);
          return retrieveCategoryList(nexusId, nexus);
        })
        .then((categories: ICategoryDictionary) => {
          api.events.emit('update-categories', gameId, categories, isUpdate);
        })
        .catch(ProcessCanceled, () => null)
        .catch(TimeoutError, () => {
          api.sendNotification({
            type: 'warning',
            message: 'Timeout retrieving categories from server, please try again later.',
          });
        })
        .catch(err => {
          if (err.code === 'ESOCKETTIMEDOUT') {
            api.sendNotification({
              type: 'warning',
              message: 'Timeout retrieving categories from server, please try again later.',
            });
            return;
          } else if (err.syscall === 'getaddrinfo') {
            api.sendNotification({
              type: 'warning',
              message: 'Failed to retrieve categories from server because network address '
                     + '"{{host}}" could not be resolved. This is often a temporary error, '
                     + 'please try again later.',
              replace: { host: err.host || err.hostname },
            });
          } else if (err.code === 'ENOTFOUND') {
            api.sendNotification({
              type: 'warning',
              message: 'Failed to resolve address of server. This is probably a temporary problem '
                      + 'with your own internet connection.',
            });
            return;
          } else if (['ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED'].indexOf(err.code) !== -1) {
            api.sendNotification({
              type: 'warning',
              message: 'The server refused the connection, please try again later.',
            });
            return;
          }

          const detail = processErrorMessage(err);
          let allowReport = detail.Servermessage === undefined;
          if (detail.noReport) {
            allowReport = false;
            delete detail.noReport;
          }
          showError(api.store.dispatch, 'Failed to retrieve categories', detail,
                    { allowReport });
        });
    }
  });
}

function openNexusPage(state: IState, gameIds: string[]) {
  const game = gameById(state, gameIds[0]);
  opn(`https://www.nexusmods.com/${nexusGameId(game)}`).catch(err => undefined);
}

function processAttributes(input: any) {
  const nexusChangelog = getSafe(input.nexus, ['fileInfo', 'changelog_html'], undefined);

  const modName = decodeHTML(getSafe(input, ['download', 'modInfo', 'nexus',
                                                'modInfo', 'name'], undefined));
  const fileName = decodeHTML(getSafe(input, ['download', 'modInfo', 'nexus',
                                                'fileInfo', 'name'], undefined));
  const fuzzRatio = ((modName !== undefined) && (fileName !== undefined))
    ? fuzz.ratio(modName, fileName)
    : 100;

  return ({
    modId: getSafe(input, ['download', 'modInfo', 'nexus', 'ids', 'modId'], undefined),
    fileId: getSafe(input, ['download', 'modInfo', 'nexus', 'ids', 'fileId'], undefined),
    author: getSafe(input, ['download', 'modInfo', 'nexus', 'modInfo', 'author'], undefined),
    category: getSafe(input, ['download', 'modInfo', 'nexus', 'modInfo', 'category_id'], undefined),
    pictureUrl: getSafe(input, ['download', 'modInfo', 'nexus',
                                'modInfo', 'picture_url'], undefined),
    description: getSafe(input, ['download', 'modInfo', 'nexus',
                                 'modInfo', 'description'], undefined),
    shortDescription: getSafe(input, ['download', 'modInfo', 'nexus',
                                      'modInfo', 'summary'], undefined),
    fileType: getSafe(input, ['download', 'modInfo', 'nexus',
                              'fileInfo', 'category_name'], undefined),
    isPrimary: getSafe(input, ['download', 'modInfo', 'nexus',
                               'fileInfo', 'is_primary'], undefined),
    modName,
    logicalFileName: fileName,
    changelog: truthy(nexusChangelog) ? { format: 'html', content: nexusChangelog } : undefined,
    uploadedTimestamp: getSafe(input, ['download', 'modInfo', 'nexus',
                                       'fileInfo', 'uploaded_timestamp'], undefined),
    version: getSafe(input, ['download', 'modInfo', 'nexus', 'fileInfo', 'version'], undefined),
    modVersion: getSafe(input, ['download', 'modInfo', 'nexus', 'modInfo', 'version'], undefined),
    customFileName: fuzzRatio < 50 ? `${modName} - ${fileName}` : undefined,
  });
}

function bringToFront() {
  remote.getCurrentWindow().setAlwaysOnTop(true);
  remote.getCurrentWindow().show();
  remote.getCurrentWindow().setAlwaysOnTop(false);
}

let cancelLogin: () => void;

function genId() {
  try {
    const uuid = require('uuid');
    return uuid.v4();
  } catch (err) {
    // odd, still unidentified bugs where bundled modules fail to load.
    log('warn', 'failed to import uuid module', err.message);
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.apply(null, Array(10))
      .map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
    // the probability that this fails for another user at exactly the same time
    // and they both get the same random number is practically 0
  }
}

interface INexusLoginMessage {
  id: string;
  appid: string;
  protocol: number;
  token?: string;
}

function requestLogin(api: IExtensionApi, callback: (err: Error) => void) {
  const stackErr = new Error();

  let connection: WebSocket;

  const loginMessage: INexusLoginMessage = {
    id: genId(),
    appid: 'Vortex',
    protocol: 2,
  };

  let keyReceived: boolean = false;
  let connectionAlive: boolean = true;
  let error: Error;
  let attempts = 5;

  const connect = () => {
    connection = new WebSocket('wss://sso.nexusmods.com')
      .on('open', () => {
        cancelLogin = () => {
          connection.close();
        };
        connection.send(JSON.stringify(loginMessage), err => {
          api.store.dispatch(setLoginId(loginMessage.id));
          if (err) {
            api.showErrorNotification('Failed to start login', err);
            connection.close();
          }
        });
        // open the authorization page - but not on reconnects!
        if (loginMessage.token === undefined) {
          opn(getPageURL(loginMessage.id)).catch(err => undefined);
        }
        const keepAlive = setInterval(() => {
          if (!connectionAlive) {
            connection.terminate();
            clearInterval(keepAlive);
          } else if (connection.readyState === WebSocket.OPEN) {
            connection.ping();
          } else {
            clearInterval(keepAlive);
          }
        }, 30000);
      })
      .on('close', (code: number, reason: string) => {
        if (!keyReceived) {
          if (code === 1005) {
            api.store.dispatch(setLoginId(undefined));
            cancelLogin = undefined;
            bringToFront();
            callback(new UserCanceled());
          } else if (attempts-- > 0) {
            // automatic reconnect
            connect();
          } else {
            cancelLogin = undefined;
            bringToFront();
            api.store.dispatch(setLoginId('__failed'));
            api.store.dispatch(setLoginError((error !== undefined)
              ? prettifyNodeErrorMessage(error).message
              : 'Log-in connection closed prematurely'));

            let err = error;
            if (err === undefined) {
              err = new ProcessCanceled(
                `Log-in connection closed prematurely (Code ${code})`);
              err.stack = stackErr.stack;
            }
            callback(err);
          }
        }
      })
      .on('pong', () => {
        connectionAlive = true;
        attempts = 5;
      })
      .on('message', data => {
        try {
          const response = JSON.parse(data.toString());

          if (response.success) {
              if (response.data.connection_token !== undefined) {
                loginMessage.token = response.data.connection_token;
              } else if (response.data.api_key !== undefined) {
                connection.close();
                api.store.dispatch(setLoginId(undefined));
                api.store.dispatch(setUserAPIKey(response.data.api_key));
                bringToFront();
                keyReceived = true;
                callback(null);
              }
          } else {
            const err = new Error(response.error);
            err.stack = stackErr.stack;
            callback(err);
          }
        } catch (err) {
          err.stack = stackErr.stack;
          callback(err);
        }
      })
      .on('error', err => {
        // Cloudflare will serve 503 service unavailable errors when/if
        //  it is unable to reach the SSO server.
        error = err.message.startsWith('Unexpected server response')
          ? new ServiceTemporarilyUnavailable('Login')
          : err;

        connection.close();
      });
  };

  try {
    connect();
  } catch (err) {
    callback(err);
  }
}

function doDownload(api: IExtensionApi, url: string) {
  return startDownload(api, nexus, url)
  .catch(DownloadIsHTML, () => undefined)
  // DataInvalid is used here to indicate invalid user input or invalid
  // data from remote, so it's presumably not a bug in Vortex
  .catch(DataInvalid, () => {
    api.showErrorNotification('Failed to start download', url, { allowReport: false });
  })
  .catch(err => {
    api.showErrorNotification('Failed to start download', err);
  });
}

function ensureLoggedIn(api: IExtensionApi): Promise<void> {
  if (sel.apiKey(api.store.getState()) === undefined) {
    return new Promise((resolve, reject) => {
      api.sendNotification({
        type: 'info',
        title: 'Not logged in',
        message: 'Nexus Mods requires Vortex to be logged in for downloading',
        actions: [
          {
            title: 'Log in',
            action: (dismiss: () => void) => {
              requestLogin(api, (err) => {
                if (err !== null) {
                  return reject(err);
                } else {
                  dismiss();
                  return resolve();
                }
              });
            },
          },
        ],
      });
    });
  } else {
    return Promise.resolve();
  }
}

function onceMain(api: IExtensionApi) {
  try {
    const stat = fs.statSync(requestLog.logPath);
    const now = new Date();
    if (stat.mtime.getUTCDate() !== now.getUTCDate()) {
      fs.removeSync(requestLog.logPath);
    }
  } catch (err) {
  }
}

function once(api: IExtensionApi) {
  const registerFunc = (def?: boolean) => {
    if (def === undefined) {
      api.store.dispatch(setAssociatedWithNXMURLs(true));
    }

    if (api.registerProtocol('nxm', def !== false, (url: string) => {
      ensureLoggedIn(api)
        .then(() => doDownload(api, url))
        // doDownload handles all download errors so the catches below are
        //  only for log in errors
        .catch(UserCanceled, () => null)
        .catch(ProcessCanceled, err => {
          api.showErrorNotification('Log-in failed', err, {
            id: 'failed-get-nexus-key',
            allowReport: false,
          });
        })
        .catch(ServiceTemporarilyUnavailable, err => {
          api.showErrorNotification('Service temporarily unavailable', err, {
            id: 'failed-get-nexus-key',
            allowReport: false,
          });
        })
        .catch(err => {
          api.showErrorNotification('Failed to get access key', err, {
            id: 'failed-get-nexus-key'
          });
        });
    })) {
      api.sendNotification({
        type: 'info',
        message: 'Vortex will now handle Nexus Download links',
        actions: [
          { title: 'More', action: () => {
            api.showDialog('info', 'Download link handling', {
              text: 'Only one application can be set up to handle Nexus "Mod Manager Download" '
                  + 'links, Vortex is now registered to do that.\n\n'
                  + 'To use a different application for these links, please go to '
                  + 'Settings->Downloads, disable the "Handle Nexus Links" option, then go to '
                  + 'the application you do want to handle the links and enable the corresponding '
                  + 'option there.',
            }, [
              { label: 'Close' },
            ]);
          } },
        ],
      });
    }
  };

  { // limit lifetime of state
    const state = api.store.getState();

    const Nexus: typeof NexusT = require('nexus-api').default;
    const apiKey = getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], undefined);
    const gameMode = activeGameId(state);

    nexus = new Proxy(
      new Proxy(
        new Nexus('Vortex', remote.app.getVersion(), gameMode, 30000),
        requestLog),
      new Disableable(api));

    updateKey(api, nexus, apiKey);

    registerFunc(getSafe(state, ['settings', 'nexus', 'associateNXM'], undefined));
  }

  api.onAsync('check-mods-version', eh.onCheckModsVersion(api, nexus));
  api.events.on('endorse-mod', eh.onEndorseMod(api, nexus));
  api.events.on('submit-feedback', eh.onSubmitFeedback(nexus));
  api.events.on('mod-update', eh.onModUpdate(api, nexus));
  api.events.on('open-mod-page', eh.onOpenModPage(api));
  api.events.on('request-nexus-login', callback => requestLogin(api, callback));
  api.events.on('request-own-issues', eh.onRequestOwnIssues(nexus));
  api.events.on('retrieve-category-list', (isUpdate: boolean) => {
    retrieveCategories(api, isUpdate);
  });
  api.events.on('gamemode-activated', (gameId: string) => { nexus.setGame(gameId); });
  api.events.on('did-import-downloads', (dlIds: string[]) => { queryInfo(api, dlIds); });

  api.onStateChange(['settings', 'nexus', 'associateNXM'],
    eh.onChangeNXMAssociation(registerFunc, api));
  api.onStateChange(['confidential', 'account', 'nexus', 'APIKey'],
    eh.onAPIKeyChanged(api, nexus));
  api.onStateChange(['persistent', 'mods'], eh.onChangeMods(api, nexus));
  api.onStateChange(['persistent', 'downloads', 'files'], eh.onChangeDownloads(api, nexus));

  api.addMetaServer('nexus_api',
                    { nexus, url: 'https://api.nexusmods.com', cacheDurationSec: 86400 });

  nexus.getModInfo(1, 'site')
    .then(info => {
      api.store.dispatch(setNewestVersion(info.version));
    })
    .catch(err => {
      // typically just missing the api key or a downtime
      log('info', 'failed to determine newest Vortex version', { error: err.message });
    });
}

function toolbarBanner(t: I18next.TFunction): React.StatelessComponent<any> {
  return () => {
    return (
      <div className='nexus-main-banner' style={{ background: 'url(assets/images/ad-banner.png)' }}>
        <div>{t('Go Premium')}</div>
        <div>{t('Uncapped downloads, no adverts')}</div>
        <div>{t('Support Nexus Mods')}</div>
        <div className='right-center'>
          <Button bsStyle='ad' onClick={goBuyPremium}>{t('Go Premium')}</Button>
        </div>
      </div>);
  };
}

function goBuyPremium() {
  opn('https://www.nexusmods.com/register/premium').catch(err => undefined);
}

function queryInfo(api: IExtensionApi, instanceIds: string[]) {
  if (instanceIds === undefined) {
    return;
  }

  const state: IState = api.store.getState();

  Promise.map(instanceIds, dlId => {
    const dl = state.persistent.downloads.files[dlId];
    const gameId = Array.isArray(dl.game) ? dl.game[0] : dl.game;
    const downloadPath = downloadPathForGame(state, gameId);
    if ((downloadPath === undefined) || (dl.localPath === undefined) || (dl.state !== 'finished')) {
      // almost certainly dl.localPath is undefined with a bugged download
      return;
    }
    return api.lookupModMeta({
      fileMD5: dl.fileMD5,
      filePath: path.join(downloadPath, dl.localPath),
      gameId,
      fileSize: dl.size,
    })
    .then((modInfo: ILookupResult[]) => {
      if (modInfo.length > 0) {
        const info = modInfo[0].value;
        try {
          const nxmUrl = new NXMUrl(info.sourceURI);
          api.store.dispatch(setDownloadModInfo(dlId, 'source', 'nexus'));
          api.store.dispatch(setDownloadModInfo(dlId, 'nexus.ids.gameId', nxmUrl.gameId));
          api.store.dispatch(setDownloadModInfo(dlId, 'nexus.ids.fileId', nxmUrl.fileId));
          api.store.dispatch(setDownloadModInfo(dlId, 'nexus.ids.modId', nxmUrl.modId));

          api.store.dispatch(setDownloadModInfo(dlId, 'version', info.fileVersion));
          api.store.dispatch(setDownloadModInfo(dlId, 'game', info.gameId));
          api.store.dispatch(setDownloadModInfo(dlId, 'name',
                                                info.logicalFileName || info.fileName));
        } catch (err) {
          // failed to parse the uri as an nxm link - that's not an error in this case, if
          // the meta server wasn't nexus mods this is to be expected
        }
      }
    })
    .catch(err => {
      log('warn', 'failed to look up mod meta info', { message: err.message });
    });
  })
  .then(() => {
    log('debug', 'done querying info', { archiveIds: instanceIds });
  });
}

function init(context: IExtensionContextExt): boolean {
  context.registerAction('application-icons', 200, LoginIcon, {}, () => ({ nexus }));
  context.registerAction('mods-action-icons', 999, 'open-ext', {}, 'Open on Nexus Mods',
                         instanceIds => {
    const state: IState = context.api.store.getState();
    const gameMode = activeGameId(state);
    const mod: IMod = getSafe(state.persistent.mods, [gameMode, instanceIds[0]], undefined);
    if (mod !== undefined) {
      const gameId = mod.attributes.downloadGame !== undefined
        ? mod.attributes.downloadGame
        : gameMode;
      context.api.events.emit('open-mod-page', gameId, mod.attributes.modId);
    } else {
      const ids = getSafe(state.persistent.downloads,
                          ['files', instanceIds[0], 'modInfo', 'nexus', 'ids'],
                          undefined);
      if (ids !== undefined) {
        context.api.events.emit('open-mod-page', ids.gameId || gameMode, ids.modId);
      }
    }
  }, instanceIds => {
    const state: IState = context.api.store.getState();
    const gameMode = activeGameId(state);

    let modSource = getSafe(state.persistent.mods,
                            [gameMode, instanceIds[0], 'attributes', 'source'],
                            undefined);
    if (modSource === undefined) {
      modSource = getSafe(state.persistent.downloads,
                          ['files', instanceIds[0], 'modInfo', 'source'],
                          undefined);
    }

    return modSource === 'nexus';
  });

  const queryCondition = (instanceIds: string[]) => {
    const state: IState = context.api.store.getState();
    const incomplete = instanceIds.find(instanceId =>
      getSafe<DownloadState>(state.persistent.downloads.files, [instanceId, 'state'], 'init')
      !== 'finished');
    return incomplete === undefined
      ? true
      : context.api.translate('Can only query finished downloads') as string;
  };
  context.registerAction('downloads-action-icons', 100, 'refresh', {}, 'Query Info',
    (instanceIds: string[]) => queryInfo(context.api, instanceIds), queryCondition);
  context.registerAction('downloads-multirow-actions', 100, 'refresh', {}, 'Query Info',
    (instanceIds: string[]) => queryInfo(context.api, instanceIds), queryCondition);

  // this makes it so the download manager can use nxm urls as download urls
  context.registerDownloadProtocol('nxm', (input: string): Promise<IResolvedURL> => {
    const state = context.api.store.getState();

    let url: NXMUrl;
    try {
      url = new NXMUrl(input);
    } catch (err) {
      return Promise.reject(err);
    }

    const userId: number = getSafe(state, ['persistent', 'nexus', 'userInfo', 'userId'], undefined);
    if ((url.userId !== undefined) && (url.userId !== userId)) {
      const userName: string =
        getSafe(state, ['persistent', 'nexus', 'userInfo', 'name'], undefined);
      context.api.showErrorNotification('Invalid download links',
        'The link was not created for this account ({{userName}}). '
        + 'You have to be logged into nexusmods.com with the same account that you use in Vortex.',
        { allowReport: false, replace: { userName } });
      return Promise.reject(new ProcessCanceled('Wrong user id'));
    }

    const games = knownGames(state);
    const gameId = convertNXMIdReverse(games, url.gameId);
    const pageId = nexusGameId(gameById(state, gameId), url.gameId);
    return Promise.resolve()
      .then(() => nexus.getDownloadURLs(url.modId, url.fileId, url.key, url.expires, pageId))
      .then((res: IDownloadURL[]) => ({ urls: res.map(u => u.URI), meta: {} }))
      .catch(NexusError, err => {
        const newError = new HTTPError(err.statusCode, err.message, err.request);
        newError.stack = err.stack;
        return Promise.reject(newError);
      })
      .catch(RateLimitError, err => {
        context.api.showErrorNotification('Rate limit exceeded', err, { allowReport: false });
        return Promise.reject(err);
      });
  });

  context.registerSettings('Download', LazyComponent(() => require('./views/Settings')));
  context.registerReducer(['confidential', 'account', 'nexus'], accountReducer);
  context.registerReducer(['settings', 'nexus'], settingsReducer);
  context.registerReducer(['persistent', 'nexus'], persistentReducer);
  context.registerReducer(['session', 'nexus'], sessionReducer);
  context.registerDialog('login-dialog', LoginDialog, () => ({
    onCancelLogin: () => {
      if (cancelLogin !== undefined) {
        cancelLogin();
      }
      context.api.store.dispatch(setLoginId(undefined));
    },
  }));
  context.registerBanner('downloads', () => {
    const t = context.api.translate;
    return (
      <div className='nexus-download-banner'>
        {t('Nexus downloads are capped at 1MB/s - '
          + 'Go Premium for uncapped download speeds')}
        <Button bsStyle='ad' onClick={goBuyPremium}>{t('Go Premium')}</Button>
      </div>);
  }, {
    props: {
      isPremium: state => getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], false),
    },
    condition: (props: any): boolean => !props.isPremium,
  });

  context.registerBanner('main-toolbar', toolbarBanner(context.api.translate), {
    props: {
      isPremium: state => getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], false),
      isSupporter: state =>
        getSafe(state, ['persistent', 'nexus', 'userInfo', 'isSupporter'], false),
    },
    condition: (props: any): boolean => !props.isPremium && !props.isSupporter,
  });

  context.registerModSource('nexus', 'Nexus Mods', () => {
    currentGame(context.api.store)
      .then(game => {
        opn(`https://www.nexusmods.com/${nexusGameId(game)}`).catch(err => undefined);
      });
  });

  context.registerAction('categories-icons', 100, 'download', {}, 'Retrieve categories',
    () => retrieveCategories(context.api, true));

  context.registerTableAttribute('mods', genEndorsedAttribute(context.api,
    (gameId: string, modId: string, endorseStatus: string) =>
      endorseModImpl(context.api, nexus, gameId, modId, endorseStatus)));
  context.registerTableAttribute('mods', genGameAttribute(context.api));
  context.registerTableAttribute('mods', genModIdAttribute(context.api));

  context.registerDashlet('Nexus Mods Account Banner', 3, 1, 0, DashboardBanner,
                          undefined, undefined, {
    fixed: true,
    closable: true,
  });

  context.registerDashlet('Go Premium', 1, 2, 200, GoPremiumDashlet, (state: IState) =>
    (getSafe(state, ['persistent', 'nexus', 'userInfo', 'isPremium'], undefined) !== true)
    && (getSafe(state, ['persistent', 'nexus', 'userInfo', 'isSupporter'], undefined) !== true),
    undefined, {
    fixed: false,
    closable: false,
  });

  context.registerAttributeExtractor(50, (input: any) => {
    return Promise.resolve(processAttributes(input));
  });

  context.registerAction('game-discovered-buttons', 120, 'nexus', {},
                         context.api.translate('Open Nexus Page'),
                         (games: string[]) => openNexusPage(context.api.store.getState(), games));

  context.registerAction('game-managed-buttons', 120, 'nexus', {},
                         context.api.translate('Open Nexus Page'),
                         (games: string[]) => openNexusPage(context.api.store.getState(), games));

  context.registerAction('game-undiscovered-buttons', 120, 'nexus', {},
                         context.api.translate('Open Nexus Page'),
                         (games: string[]) => openNexusPage(context.api.store.getState(), games));

  context.once(() => once(context.api));
  context.onceMain(() => onceMain(context.api));

  return true;
}

export default init;
