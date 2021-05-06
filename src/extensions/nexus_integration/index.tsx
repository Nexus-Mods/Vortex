import { setDownloadModInfo, setModAttribute } from '../../actions';
import { IDialogResult, showDialog } from '../../actions/notifications';
import { IExtensionApi, IExtensionContext, ILookupResult } from '../../types/IExtensionContext';
import { IModLookupResult } from '../../types/IModLookupResult';
import { IState } from '../../types/IState';
import { DataInvalid, HTTPError, ProcessCanceled,
         ServiceTemporarilyUnavailable, UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import * as fs from '../../util/fs';
import LazyComponent from '../../util/LazyComponent';
import { log, LogLevel } from '../../util/log';
import { prettifyNodeErrorMessage, showError } from '../../util/message';
import opn from '../../util/opn';
import { activeGameId, downloadPathForGame, gameById, knownGames } from '../../util/selectors';
import { currentGame, getSafe } from '../../util/storeHelper';
import { decodeHTML, truthy } from '../../util/util';

import { ICategoryDictionary } from '../category_management/types/ICategoryDictionary';
import { DownloadIsHTML } from '../download_management/DownloadManager';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { IMod, IModRepoId } from '../mod_management/types/IMod';

import { DownloadState } from '../download_management/types/IDownload';
import { IResolvedURL } from '../download_management/types/ProtocolHandlers';

import { SITE_ID } from '../gamemode_management/constants';

import { setUserAPIKey } from './actions/account';
import { setNewestVersion } from './actions/persistent';
import { setLoginError, setLoginId } from './actions/session';
import { setAssociatedWithNXMURLs } from './actions/settings';
import { accountReducer } from './reducers/account';
import { persistentReducer } from './reducers/persistent';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';
import { convertNXMIdReverse, nexusGameId } from './util/convertGameId';
import { guessFromFileName } from './util/guessModID';
import retrieveCategoryList from './util/retrieveCategories';
import { getPageURL } from './util/sso';
import Tracking from './util/tracking';
import DashboardBanner from './views/DashboardBanner';
import GoPremiumDashlet from './views/GoPremiumDashlet';
import LoginDialog from './views/LoginDialog';
import LoginIcon from './views/LoginIcon';
import { } from './views/Settings';

import {
  genCollectionIdAttribute,
  genEndorsedAttribute,
  genGameAttribute,
  genModIdAttribute } from './attributes';
import { NEXUS_API_SUBDOMAIN, NEXUS_BASE_URL, NEXUS_DOMAIN, NEXUS_MEMBERSHIP_URL } from './constants';
import * as eh from './eventHandlers';
import NXMUrl from './NXMUrl';
import * as sel from './selectors';
import { endorseModImpl, getCollectionInfo, getInfo, IRemoteInfo, nexusGames, nexusGamesProm, processErrorMessage,
         startDownload, updateKey } from './util';

import NexusT, { IDateTime, IDownloadURL, IFileInfo,
  IModFile,
  IModFileQuery,
  IModInfo, IRevision, NexusError, RateLimitError, TimeoutError } from '@nexusmods/nexus-api';
import Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fuzz from 'fuzzball';
import { TFunction } from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { Button } from 'react-bootstrap';
import {} from 'uuid';
import WebSocket from 'ws';

const app = remote !== undefined ? remote.app : appIn;

let nexus: NexusT;

export class APIDisabled extends Error {
  constructor(instruction: string) {
    super(`Network functionality disabled "${instruction}"`);
    this.name = this.constructor.name;
  }
}

// functions in the nexus api that don't trigger requests but instead are
// management functions to control the our api connection
const mgmtFuncs = new Set(['setGame', 'getValidationResult', 'getRateLimits', 'setLogger']);

class Disableable {
  private mDisabled = false;
  private mApi: IExtensionApi;

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  public get(obj, prop) {
    const state: IState = this.mApi.store.getState();
    const { networkConnected } = state.session.base;
    if (prop === 'disable') {
      return () => this.mDisabled = true;
    } else if (mgmtFuncs.has(prop) || (typeof obj[prop] !== 'function')) {
      return obj[prop];
    } else if (!networkConnected) {
      return () => Promise.reject(new ProcessCanceled('network disconnected'));
    } else if (this.mDisabled) {
      return () => Promise.reject(new APIDisabled(prop));
    } else if (prop === 'getFileByMD5') {
      return (hash: string, gameId?: string) => {
        if (gameId?.toLowerCase() === 'skyrimse') {
          this.mApi.showErrorNotification(
            'Attempt to send invalid API request, please report this (once)',
            new Error(`getFileByMD5 called with game id ${gameId}`),
            { id: 'api-invalid-gameid' });
          gameId = 'skyrimspecialedition';
        }
        return obj[prop](hash, gameId);
      };
    } else {
      return obj[prop];
    }
  }
}

function getCaller() {
  // save original values
  const origLimit = Error.stackTraceLimit;
  const origHandler = Error.prepareStackTrace;

  // set up error to return the vanilla v8 stack trace
  const dummyObject: { stack?: any } = {};
  Error.stackTraceLimit = Infinity;
  Error.prepareStackTrace = (dummyObject, trace) => trace;
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
      .then(() => null);
  }, 500),
  log(prop: string, args: any[], caller: string) {
    this.requests.push(`success - (${Date.now()}) ${prop} (${args.join(', ')}) from ${caller}`);
    this.debouncer.schedule();
  },
  logErr(prop: string, args: any[], caller: string, err: Error) {
    this.requests.push(
      `failed - (${Date.now()}) ${prop} (${args.join(', ')}) from ${caller}: ${err.message}`);
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
          });
        } else {
          return prom;
        }
      };
    }
  },
};

export interface IExtensionContextExt extends IExtensionContext {
  registerDownloadProtocol: (
    schema: string,
    handler: (inputUrl: string, name: string) => Promise<{ urls: string[], meta: any }>) => void;
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
            return;
          } else if (['ENOTFOUND', 'ENOENT'].includes(err.code)) {
            api.sendNotification({
              type: 'warning',
              message: 'Failed to resolve address of server. This is probably a temporary problem '
                      + 'with your own internet connection.',
            });
            return;
          } else if (['ENETUNREACH'].includes(err.code)) {
            api.sendNotification({
              type: 'warning',
              message: 'Server can\'t be reached, please check your internet connection.',
            });
            return;
          } else if (['ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED'].includes(err.code)) {
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
  opn(`https://www.${NEXUS_DOMAIN}/${nexusGameId(game)}`).catch(err => undefined);
}

function remapCategory(state: IState, category: number, fromGame: string, toGame: string) {
  if ((fromGame === toGame) || (fromGame === undefined)) {
    // should be the default case: we're installing the mod for the game it's intended for
    return category;
  }

  const fromCategory =
    getSafe(state, ['persistent', 'categories', fromGame, category, 'name'], undefined);
  const toGameCategories: Array<{ name: string }> =
    getSafe(state, ['persistent', 'categories', toGame], undefined);

  if ((fromCategory === undefined) || (toGameCategories === undefined)) {
    return category;
  }

  const sorted = Object.keys(toGameCategories).sort((lhs, rhs) =>
    fuzz.ratio(toGameCategories[rhs].name, fromCategory)
    - fuzz.ratio(toGameCategories[lhs].name, fromCategory));

  return sorted[0];
}

function toTimestamp(time?: IDateTime | string): number {
  if (time === undefined) {
    return 0;
  }
  if (typeof(time) === 'string') {
    return (new Date(time)).getTime();
  } else {
    return (new Date(time.year, time.month, time.day, time.hour, time.minute, time.second)).getTime();
  }
}

function processAttributes(state: IState, input: any, quick: boolean): Promise<any> {
  const nexusChangelog = getSafe(input.nexus, ['fileInfo', 'changelog_html'], undefined);

  const modName = decodeHTML(getSafe(input, ['download', 'modInfo', 'nexus',
                                                'modInfo', 'name'], undefined));
  const fileName = decodeHTML(getSafe(input, ['download', 'modInfo', 'nexus',
                                                'fileInfo', 'name'], undefined));
  const fuzzRatio = ((modName !== undefined) && (fileName !== undefined))
    ? fuzz.ratio(modName, fileName)
    : 100;

  let fetchPromise: Promise<IRemoteInfo> = Promise.resolve(undefined);

  const gameId = getSafe(input, ['download', 'modInfo', 'game'], undefined);
  if ((getSafe(input, ['download', 'modInfo', 'nexus'], undefined) === undefined)
      && (getSafe(input, ['download', 'modInfo', 'source'], undefined) === 'nexus')) {
    const modId = getSafe(input, ['download', 'modInfo', 'ids', 'modId'], undefined);
    const fileId = getSafe(input, ['download', 'modInfo', 'ids', 'fileId'], undefined);
    const revisionId = getSafe(input, ['download', 'modInfo', 'ids', 'revisionId'], undefined);

    if (!quick) {
      if (truthy(gameId) && truthy(modId) && truthy(fileId)) {
        const domain = nexusGameId(gameById(state, gameId), gameId);
        fetchPromise = getInfo(nexus, domain, parseInt(modId, 10), parseInt(fileId, 10))
          .catch(err => {
            log('error', 'failed to fetch nexus info during mod install',
              { gameId, modId, fileId, error: err.message });
            return undefined;
          });
      } else if (truthy(revisionId)) {
        fetchPromise = getCollectionInfo(nexus, revisionId);
      }
    }
  }

  return fetchPromise.then((info: IRemoteInfo) => {
    const nexusModInfo: IModInfo =
      info?.modInfo ?? input.download?.modInfo?.nexus?.modInfo;
    const nexusFileInfo: IFileInfo =
      info?.fileInfo ?? input.download?.modInfo?.nexus?.fileInfo;
    const nexusCollectionInfo: IRevision =
      info?.revisionInfo ?? input.download?.modInfo?.nexus?.revisionInfo;

    const gameMode = activeGameId(state);
    const category = remapCategory(state, nexusModInfo?.category_id, gameId, gameMode);

    return {
      modId: input.download?.modInfo?.nexus?.ids?.modId,
      fileId: input.download?.modInfo?.nexus?.ids?.fileId,
      collectionId: input.download?.modInfo?.nexus?.ids?.collectionId,
      revisionId: input.download?.modInfo?.nexus?.ids?.revisionId,
      author: nexusModInfo?.author ?? nexusCollectionInfo?.collection?.user?.name,
      uploader: nexusModInfo?.uploaded_by ?? nexusCollectionInfo?.collection?.user?.name,
      uploader_url: input.download?.modInfo?.nexus?.modInfo?.uploaded_users_profile_url,
      category,
      pictureUrl: nexusModInfo?.picture_url ?? nexusCollectionInfo?.collection?.tileImage,
      description: nexusModInfo?.description ?? nexusCollectionInfo?.collection?.metadata?.description,
      shortDescription: nexusModInfo?.summary ?? nexusCollectionInfo?.collection?.metadata?.summary,
      fileType: nexusFileInfo?.category_name,
      isPrimary: nexusFileInfo?.is_primary,
      modName,
      logicalFileName: fileName,
      changelog: truthy(nexusChangelog) ? { format: 'html', content: nexusChangelog } : undefined,
      uploadedTimestamp: nexusFileInfo?.uploaded_timestamp ?? toTimestamp(nexusCollectionInfo?.createdAt),
      updatedTimestamp: toTimestamp(nexusCollectionInfo?.updatedAt),
      version: nexusFileInfo?.version ?? (nexusCollectionInfo?.revision?.toString?.()),
      modVersion: nexusModInfo?.version ?? (nexusCollectionInfo?.revision?.toString?.()),
      allowRating: input?.download?.modInfo?.nexus?.modInfo?.allow_rating,
      customFileName: fuzzRatio < 50 ? `${modName} - ${fileName}` : undefined,
      rating: nexusCollectionInfo?.rating,
      votes: nexusCollectionInfo?.votes,
    };
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
    connection = new WebSocket(`wss://sso.${NEXUS_DOMAIN}`)
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
          if (err.message.startsWith('Unexpected token')) {
            err.message = 'Failed to parse: ' + data.toString();
          }
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

function doDownload(api: IExtensionApi, url: string): Promise<string> {
  return startDownload(api, nexus, url)
  .catch(DownloadIsHTML, () => undefined)
  // DataInvalid is used here to indicate invalid user input or invalid
  // data from remote, so it's presumably not a bug in Vortex
  .catch(DataInvalid, () => {
    api.showErrorNotification('Failed to start download', url, { allowReport: false });
    return Promise.resolve(undefined);
  })
  .catch(UserCanceled, () => Promise.resolve(undefined))
  .catch(err => {
    api.showErrorNotification('Failed to start download', err);
    return Promise.resolve(undefined);
  });
}

function ensureLoggedIn(api: IExtensionApi): Promise<void> {
  if (sel.apiKey(api.store.getState()) === undefined) {
    return api.showDialog('info', 'Not logged in', {
        text: 'Nexus Mods requires Vortex to be logged in for downloading',
      }, [
        { label: 'Cancel' },
        { label: 'Log in' },
      ])
      .then(result => {
        if (result.action === 'Log in') {
          return new Promise((resolve, reject) => {
              requestLogin(api, (err) => {
                if (err !== null) {
                  return reject(err);
                } else {
                  return resolve();
                }
              });
            });
        } else {
          return Promise.reject(new UserCanceled());
        }
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
    // nop
  }
}

interface IAwaitedLink {
  gameId: string;
  modId: number;
  fileId: number;
  resolve: (url: string) => void;
}

const awaitedLinks: IAwaitedLink[] = [];

function makeNXMLinkCallback(api: IExtensionApi) {
  return (url: string, install: boolean) => {
    let nxmUrl: NXMUrl;
    try {
      nxmUrl = new NXMUrl(url);
      const isExtAvailable = api.getState().session.extensions.available
        .find(iter => iter.modId === nxmUrl.modId) !== undefined;
      if (nxmUrl.gameId === SITE_ID && isExtAvailable) {
        if (install) {
          return api.emitAndAwait('install-extension',
            { name: 'Pending', modId: nxmUrl.modId, fileId: nxmUrl.fileId });
        } else {
          api.events.emit('show-extension-page', nxmUrl.modId);
          bringToFront();
          return Promise.resolve();
        }
      } else {
        const { foregroundDL } = api.store.getState().settings.interface;
        if (foregroundDL) {
          bringToFront();
        }
      }
    } catch (err) {
      api.showErrorNotification('Invalid URL', err, { allowReport: false });
      return;
    }

    // test if we're already awaiting this link
    const awaitedIdx = awaitedLinks.findIndex(link =>
      (link.gameId === nxmUrl.gameId)
      && (link.modId === nxmUrl.modId)
      && (link.fileId === nxmUrl.fileId));
    if (awaitedIdx !== -1) {
      const awaited = awaitedLinks.splice(awaitedIdx, 1);
      awaited[0].resolve(url);
      return;
    }

    ensureLoggedIn(api)
      .then(() => doDownload(api, url))
      .then(dlId => {
        if ((dlId === undefined) || (dlId === null)) {
          return Promise.resolve(undefined);
        }

        if (nxmUrl.collectionId !== undefined) {
          setDownloadModInfo(dlId, 'collectionId', nxmUrl.collectionId);
        }
        if (nxmUrl.revisionId !== undefined) {
          setDownloadModInfo(dlId, 'revisionId', nxmUrl.revisionId);
        }

        return new Promise((resolve, reject) => {
          const state: IState = api.store.getState();
          const download = state.persistent.downloads.files[dlId];
          if (download === undefined) {
            return reject(new ProcessCanceled(`Download not found "${dlId}"`));
          }
          if (install) {
            api.events.emit('start-install-download', dlId, (err: Error, id: string) => {
              if (err !== null) {
                reject(err);
              } else {
                resolve();
              }
            });
          }
        });
      })
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
          id: 'failed-get-nexus-key',
        });
      });
  };
}

const gameNum = (() => {
  let cache: { [gameId: string]: number };
  return (gameId: string): number => {
    if (cache === undefined) {
      cache = nexusGames().reduce((prev, game) => {
        prev[game.domain_name] = game.id;
        return prev;
      }, {});
    }

    return cache[gameId];
  }
})();

function makeFileUID(repoInfo: IModRepoId): string {
  return ((BigInt(gameNum(repoInfo.gameId)) << BigInt(32))
          | BigInt(parseInt(repoInfo.fileId, 10))).toString();
}

function makeRepositoryLookup(api: IExtensionApi, nexusConn: NexusT) {
  const query: Partial<IModFileQuery> = {
    name: true,
    description: true,
    size: true,
    version: true,
    game: {
      id: true,
      domainName: true,
    },
    uid: true,
    uri: true,
    mod: {
      author: true,
      modCategory: {
        id: true,
      }
    }
  } as any;

  interface IQueueItem {
    repoInfo: IModRepoId;
    resolve: (info: any) => void;
    reject: (err: Error) => void;
  }

  let pendingQueries: IQueueItem[] = [];
  const uidLookupDebouncer = new Debouncer(() => {
    const processingQueries = pendingQueries;
    pendingQueries = [];
    return nexusGamesProm()
      .then(() => {
        return nexusConn.modFilesByUid(query, processingQueries.map(iter => makeFileUID(iter.repoInfo)) as any[])
        .then(files => {
        processingQueries.forEach(query => {
          const uid = makeFileUID(query.repoInfo);
          const res = files.find(iter => iter['uid'] === uid);
          if (res !== undefined) {
            query.resolve(res);
          } else {
            // the number of uids we can request in one call may be limited, just retry.
            // We're supposed to get an error if the request actually failed.
            pendingQueries.push(query);
          }
        });
        if (pendingQueries.length > 0) {
          uidLookupDebouncer.schedule();
        }
      });
    });
  }, 100, true);

  const queue = (repoInfo: IModRepoId): Promise<Partial<IModFile>> => {
    return new Promise((resolve, reject) => {
      pendingQueries.push({ repoInfo, resolve, reject });
      uidLookupDebouncer.schedule();
    });
  };

  return (repoInfo: IModRepoId): Promise<IModLookupResult[]> => {
    const modId = parseInt(repoInfo.modId, 10);
    const fileId = parseInt(repoInfo.fileId, 10);

    return queue(repoInfo)
      .then(modFileInfo => {
        const res: IModLookupResult = {
          key: `${repoInfo.gameId}_${repoInfo.modId}_${repoInfo.fileId}`,
          value: {
            fileName: modFileInfo.name,
            fileSizeBytes: modFileInfo.size,
            fileVersion: modFileInfo.version,
            gameId: modFileInfo.game.id.toString(),
            domainName: modFileInfo.game.domainName,
            sourceURI: `nxm://${repoInfo.gameId}/mods/${modId}/files/${fileId}`,
            source: 'nexus',
            logicalFileName: modFileInfo.name,
            rules: [],
            details: {
              modId: repoInfo.modId,
              fileId: repoInfo.fileId,
              author: modFileInfo.mod.author,
              category: (modFileInfo.mod.modCategory.id.toString()).split(',')[0],
              description: modFileInfo.description,
              homepage: `https://www.${NEXUS_DOMAIN}/${repoInfo.gameId}/mods/${modId}`,
            },
          },
        };
        return [res];
      });

    /*
    let modInfo: IModInfo;
    let fileInfo: IFileInfo;
    return Promise.resolve(nexusConn.getModInfo(modId, repoInfo.gameId))
      .then(modInfoIn => {
        modInfo = modInfoIn;
        return nexusConn.getFileInfo(modId, fileId, repoInfo.gameId);
      })
      .then(fileInfoIn => {
        fileInfo = fileInfoIn;
        const res: IModLookupResult = {
          key: `${repoInfo.gameId}_${repoInfo.modId}_${repoInfo.fileId}`,
          value: {
            fileName: fileInfo.file_name,
            fileSizeBytes: fileInfo.size,
            fileVersion: fileInfo.version,
            gameId: modInfo.game_id.toString(),
            domainName: modInfo.domain_name,
            sourceURI: `nxm://${repoInfo.gameId}/mods/${modId}/files/${fileId}`,
            source: 'nexus',
            logicalFileName: fileInfo.name,
            rules: [],
            details: {
              modId: repoInfo.modId,
              fileId: repoInfo.fileId,
              author: modInfo.author,
              category: modInfo.category_id.toString(),
              description: fileInfo.description,
              homepage: `https://www.${NEXUS_DOMAIN}/${repoInfo.gameId}/mods/${modId}`,
            },
          },
        };
        return [res];
      });
    */
  };
}

function once(api: IExtensionApi, callbacks: Array<(nexus: NexusT) => void>) {
  const registerFunc = (def?: boolean) => {
    if (def === undefined) {
      api.store.dispatch(setAssociatedWithNXMURLs(true));
    }

    if (api.registerProtocol('nxm', def !== false, makeNXMLinkCallback(api))) {
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

    const Nexus: typeof NexusT = require('@nexusmods/nexus-api').default;
    const apiKey = getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], undefined);
    const gameMode = activeGameId(state);

    nexus = new Proxy(
      new Proxy(
        new Nexus('Vortex', remote.app.getVersion(), gameMode, 30000),
        requestLog),
      new Disableable(api));

    nexus['setLogger']?.((level: LogLevel, message: string, meta: any) =>
      log(level, message, meta));

    updateKey(api, nexus, apiKey);

    registerFunc(getSafe(state, ['settings', 'nexus', 'associateNXM'], undefined));

    api.registerRepositoryLookup('nexus', true, makeRepositoryLookup(api, nexus));
  }

  api.onAsync('check-mods-version', eh.onCheckModsVersion(api, nexus));
  api.onAsync('nexus-download', eh.onNexusDownload(api, nexus));
  api.onAsync('get-nexus-collection', eh.onGetNexusCollection(api, nexus));
  api.onAsync('get-nexus-collections', eh.onGetNexusCollections(api, nexus));
  api.onAsync('resolve-collection-url', eh.onResolveCollectionUrl(api, nexus));
  api.onAsync('get-nexus-collection-revision', eh.onGetNexusRevision(api, nexus));
  api.onAsync('rate-nexus-collection-revision', eh.onRateRevision(api, nexus));
  api.onAsync('endorse-nexus-mod', eh.onEndorseDirect(api, nexus));
  api.events.on('endorse-mod', eh.onEndorseMod(api, nexus));
  api.events.on('submit-feedback', eh.onSubmitFeedback(nexus));
  api.events.on('submit-collection', eh.onSubmitCollection(nexus));
  api.events.on('mod-update', eh.onModUpdate(api, nexus));
  api.events.on('open-collection-page', eh.onOpenCollectionPage(api));
  api.events.on('open-mod-page', eh.onOpenModPage(api));
  api.events.on('request-nexus-login', callback => requestLogin(api, callback));
  api.events.on('request-own-issues', eh.onRequestOwnIssues(nexus));
  api.events.on('retrieve-category-list', (isUpdate: boolean) => {
    retrieveCategories(api, isUpdate);
  });
  api.events.on('gamemode-activated', (gameId: string) => { nexus.setGame(gameId); });
  api.events.on('did-import-downloads', (dlIds: string[]) => { queryInfo(api, dlIds, false); });

  api.onAsync('start-download-update', eh.onDownloadUpdate(api, nexus));

  api.onStateChange(['settings', 'nexus', 'associateNXM'],
    eh.onChangeNXMAssociation(registerFunc, api));
  api.onStateChange(['confidential', 'account', 'nexus', 'APIKey'],
    eh.onAPIKeyChanged(api, nexus));
  api.onStateChange(['persistent', 'mods'], eh.onChangeMods(api, nexus));
  api.onStateChange(['persistent', 'downloads', 'files'], eh.onChangeDownloads(api, nexus));

  api.addMetaServer('nexus_api',
    { nexus, url: `https://${NEXUS_API_SUBDOMAIN}.${NEXUS_DOMAIN}`, cacheDurationSec: 86400 });

  nexus.getModInfo(1, SITE_ID)
    .then(info => {
      api.store.dispatch(setNewestVersion(info.version));
    })
    .catch(err => {
      // typically just missing the api key or a downtime
      log('info', 'failed to determine newest Vortex version', { error: err.message });
    });

  callbacks.forEach(cb => cb(nexus));
}

function toolbarBanner(t: TFunction): React.StatelessComponent<any> {
  return () => {
    return (
      <div className='nexus-main-banner' style={{ background: 'url(assets/images/ad-banner.png)' }}>
        <div>{t('Go Premium')}</div>
        <div>{t('Uncapped downloads, no adverts')}</div>
        <div>{t('Support Nexus Mods')}</div>
        <div className='right-center'>
          <Button bsStyle='ad' onClick={goBuyPremium}>{t('Go Premium')}</Button>
        </div>
      </div>
    );
  };
}

function goBuyPremium() {
  opn(NEXUS_MEMBERSHIP_URL).catch(err => undefined);
}

function queryInfo(api: IExtensionApi, instanceIds: string[], ignoreCache: boolean) {
  if (instanceIds === undefined) {
    return;
  }

  const state: IState = api.store.getState();

  Promise.map(instanceIds, dlId => {
    const dl = state.persistent.downloads.files[dlId];
    if (dl === undefined) {
      log('warn', 'download no longer exists', dlId);
      return;
    }
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
    }, ignoreCache)
    .then((modInfo: ILookupResult[]) => {
      if (modInfo.length > 0) {
        const info = modInfo[0].value;
        const { store } = api;

        const setInfo = (key: string, value: any) => {
          if (value !== undefined) { store.dispatch(setDownloadModInfo(dlId, key, value)); }
        };

        try {
          const nxmUrl = new NXMUrl(info.sourceURI);
          setInfo('source', 'nexus');
          setInfo('nexus.ids.gameId', nxmUrl.gameId);
          setInfo('nexus.ids.fileId', nxmUrl.fileId);
          setInfo('nexus.ids.modId', nxmUrl.modId);
        } catch (err) {
          // failed to parse the uri as an nxm link - that's not an error in this case, if
          // the meta server wasn't nexus mods this is to be expected
        }

        setInfo('meta', info);
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

function guessIds(api: IExtensionApi, instanceIds: string[]) {
  const { store } = api;
  const state: IState = store.getState();
  const gameMode = activeGameId(state);
  const mods = state.persistent.mods[gameMode];
  const downloads = state.persistent.downloads.files;
  instanceIds.forEach(id => {
    let fileName: string;

    let isDownload = false;
    if (getSafe(mods, [id], undefined) !== undefined) {
      const mod = mods[id];
      fileName = getSafe(mod.attributes, ['fileName'],
        getSafe(mod.attributes, ['name'], undefined));
    } else if (getSafe(downloads, [id], undefined) !== undefined) {
      isDownload = true;
      const download = downloads[id];
      fileName = download.localPath;
    }

    if (fileName === undefined) {
      return;
    }

    const guessed = guessFromFileName(fileName);
    if (guessed !== undefined) {
      if (isDownload) {
        store.dispatch(setDownloadModInfo(id, 'nexus.ids.modId', guessed));
      } else {
        store.dispatch(setModAttribute(gameMode, id, 'source', 'nexus'));
        store.dispatch(setModAttribute(gameMode, id, 'modId', guessed));
      }
    }
  });
}

type AwaitLinkCB = (gameId: string, modId: number, fileId: number) => Promise<string>;

function makeNXMProtocol(api: IExtensionApi, onAwaitLink: AwaitLinkCB) {
  const resolveFunc = (input: string,
                       name?: string)
                       : Promise<IResolvedURL> => {
    const state = api.store.getState();

    let url: NXMUrl;
    try {
      url = new NXMUrl(input);
    } catch (err) {
      return Promise.reject(err);
    }

    const userInfo: any = getSafe(state, ['persistent', 'nexus', 'userInfo'], undefined);
    if ((url.userId !== undefined) && (url.userId !== userInfo.userId)) {
      const userName: string =
        getSafe(state, ['persistent', 'nexus', 'userInfo', 'name'], undefined);
      api.showErrorNotification('Invalid download links',
        'The link was not created for this account ({{userName}}). '
        + 'You have to be logged into nexusmods.com with the same account that you use in Vortex.',
        { allowReport: false, replace: { userName } });
      return Promise.reject(new ProcessCanceled('Wrong user id'));
    }

    if (!userInfo?.isPremium
        && (url.type === 'mod')
        && (url.gameId !== SITE_ID)
        && (url.key === undefined)) {
      // non-premium user trying to download a file with no id, have to send the user to the
      // corresponding site to generate a proper link
      return new Promise((resolve, reject) => {
        const res = (result: IResolvedURL) => {
          if (resolve !== undefined) {
            resolve(result);
            reject = undefined;
            resolve = undefined;
          }
          resolve(result);
        };
        const rej = (err) => {
          if (reject !== undefined) {
            reject(err);
            reject = undefined;
            resolve = undefined;
          }
        };
        api.showDialog('info', 'About to open Nexus Mods', {
          text: 'Since you\'re not a premium user, every download has to be started from the '
              + 'website. Please click the button below to take you to the '
              + 'appropriate site (in your default webbrowser).\n\n'
              + 'This dialog will close automatically (or move to the next required file) '
              + 'once the download has started.',
          message: name || input,
          links: [{ label: 'Open Site', action: (dismiss) => {
            onAwaitLink(url.gameId, url.modId, url.fileId).then(updatedLink => {
              return resolveFunc(updatedLink, name)
                .then(res)
                .catch(rej)
                .finally(dismiss);
            });
            opn(`${NEXUS_BASE_URL}/${url.gameId}/mods/${url.modId}?`
                + `tab=files&file_id=${url.fileId}&nmm=1`)
              .catch(() => null);
          } }],
        }, [
          { label: 'Skip', action: () => rej(new UserCanceled()) },
        ]);
      });
    }

    const games = knownGames(state);
    const gameId = convertNXMIdReverse(games, url.gameId);
    const pageId = nexusGameId(gameById(state, gameId), url.gameId);
    return Promise.resolve()
      .then(() => (url.type === 'mod')
        ? nexus.getDownloadURLs(url.modId, url.fileId, url.key, url.expires, pageId)
          .then((res: IDownloadURL[]) =>
            ({ urls: res.map(u => u.URI), meta: {}, updatedUrl: input }))
        : nexus.getRevisionGraph({ downloadLink: true }, url.revisionId)
          .then((res: Partial<IRevision>) =>
            ({
              urls: [res.downloadLink],
              updatedUrl: input,
              meta: {
                nexus: {
                  ids: {
                    collectionId: url.collectionId,
                    revisionId: url.revisionId,
                  },
                },
              },
            })))
      .catch(NexusError, err => {
        const newError = new HTTPError(err.statusCode, err.message, err.request);
        newError.stack = err.stack;
        return Promise.reject(newError);
      })
      .catch(RateLimitError, err => {
        api.showErrorNotification('Rate limit exceeded', err, { allowReport: false });
        return Promise.reject(err);
      });
  };

  return resolveFunc;
}

function init(context: IExtensionContextExt): boolean {
  context.registerReducer(['confidential', 'account', 'nexus'], accountReducer);
  context.registerReducer(['settings', 'nexus'], settingsReducer);
  context.registerReducer(['persistent', 'nexus'], persistentReducer);
  context.registerReducer(['session', 'nexus'], sessionReducer);

  context.registerAction('application-icons', 200, LoginIcon, {}, () => ({ nexus }));
  context.registerAction('mods-action-icons', 999, 'nexus', {}, 'Open on Nexus Mods',
                         instanceIds => {
    const state: IState = context.api.store.getState();
    const gameMode = activeGameId(state);
    const mod: IMod = getSafe(state.persistent.mods, [gameMode, instanceIds[0]], undefined);
    if (mod !== undefined) {
      const gameId = mod.attributes?.downloadGame !== undefined
        ? mod.attributes?.downloadGame
        : gameMode;
      context.api.events.emit('open-mod-page',
                              gameId, mod.attributes?.modId, mod.attributes?.source);
    } else {
      const ids = getSafe(state.persistent.downloads,
                          ['files', instanceIds[0], 'modInfo', 'nexus', 'ids'],
                          undefined);
      if (ids !== undefined) {
        context.api.events.emit('open-mod-page',
                                ids.gameId || gameMode, ids.modId, 'nexus');
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

  const tracking = new Tracking(context.api);

  context.registerAction('mods-action-icons', 300, 'smart', {}, 'Guess ID',
                         instanceIds => guessIds(context.api, instanceIds));
  context.registerAction('mods-multirow-actions', 300, 'smart', {}, 'Guess IDs',
                         instanceIds => guessIds(context.api, instanceIds));
  context.registerAction('mods-multirow-actions', 250, 'track', {}, 'Track',
    instanceIds => {
      tracking.trackMods(instanceIds);
    });
  context.registerAction('mods-multirow-actions', 250, 'track', { hollowIcon: true }, 'Untrack',
    instanceIds => {
      tracking.untrackMods(instanceIds);
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

  // TODO: this shouldn't be here, it uses the meta server not the nexus api
  context.registerAction('downloads-action-icons', 100, 'refresh', {}, 'Query Info',
    (instanceIds: string[]) => queryInfo(context.api, instanceIds, true), queryCondition);
  context.registerAction('downloads-multirow-actions', 100, 'refresh', {}, 'Query Info',
    (instanceIds: string[]) => queryInfo(context.api, instanceIds, true), queryCondition);

  // this makes it so the download manager can use nxm urls as download urls
  context.registerDownloadProtocol('nxm',
      makeNXMProtocol(context.api, (gameId: string, modId: number, fileId: number) =>
    new Promise(resolve => {
      awaitedLinks.push({ gameId, modId, fileId, resolve });
    })));

  context.registerSettings('Download', LazyComponent(() => require('./views/Settings')));
  context.registerDialog('login-dialog', LoginDialog, () => ({
    onCancelLogin: () => {
      if (cancelLogin !== undefined) {
        try {
          cancelLogin();
        } catch (err) {
          // the only time we ever see this happen is a case where the websocket connection
          // wasn't established yet so the cancelation failed because it wasn't necessary.
          log('info', 'login not canceled', err.message);
        }
      }
      context.api.store.dispatch(setLoginId(undefined));
    },
  }));
  context.registerBanner('downloads', () => {
    const t = context.api.translate;
    return (
      <div className='nexus-download-banner'>
        {t('Nexus downloads are capped at 1-2MB/s - '
          + 'Go Premium for uncapped download speeds')}
        <Button bsStyle='ad' onClick={goBuyPremium}>{t('Go Premium')}</Button>
      </div>
    );
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
        opn(`${NEXUS_BASE_URL}/${nexusGameId(game)}`).catch(err => undefined);
      });
  }, {
    icon: 'nexus',
  });

  context.registerAction('categories-icons', 100, 'download', {}, 'Retrieve categories',
    () => retrieveCategories(context.api, true));

  context.registerTableAttribute('mods', genEndorsedAttribute(context.api,
    (gameId: string, modId: string, endorseStatus: string) =>
      endorseModImpl(context.api, nexus, gameId, modId, endorseStatus)));
  context.registerTableAttribute('mods', tracking.attribute());
  context.registerTableAttribute('mods', genGameAttribute(context.api));
  context.registerTableAttribute('mods', genModIdAttribute(context.api));
  context.registerTableAttribute('mods', genCollectionIdAttribute(context.api));

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

  context.registerAttributeExtractor(50, (input: any, modPath: string) => {
    return processAttributes(context.api.store.getState(), input, modPath === undefined);
  });

  context.registerAction('game-discovered-buttons', 120, 'nexus', {},
                         context.api.translate('Open Nexus Page'),
                         (games: string[]) => openNexusPage(context.api.store.getState(), games));

  context.registerAction('game-managed-buttons', 120, 'nexus', {},
                         context.api.translate('Open Nexus Page'),
                         (games: string[]) => openNexusPage(context.api.store.getState(), games));

  context.registerAction(
    'game-undiscovered-buttons', 120, 'nexus', {},
    context.api.translate('Open Nexus Page'),
    (games: string[]) => openNexusPage(context.api.store.getState(), games),
    (games: string[]) => gameById(context.api.getState(), games[0]) !== undefined,
  );

  context.registerAPI('getNexusGames', () => nexusGamesProm(), {});
  context.registerAPI('ensureLoggedIn', () => ensureLoggedIn(context.api), {});

  context.once(() => once(context.api, [(nex: NexusT) => tracking.once(nex)]));
  context.onceMain(() => onceMain(context.api));

  return true;
}

export default init;
