import { setDownloadModInfo } from '../../actions';
import { IDialogResult, showDialog } from '../../actions/notifications';
import InputButton from '../../controls/InputButton';
import { IExtensionApi, IExtensionContext, ILookupResult } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { ProcessCanceled, DataInvalid, UserCanceled, HTTPError } from '../../util/CustomErrors';
import LazyComponent from '../../util/LazyComponent';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import opn from '../../util/opn';
import { activeGameId, gameById, downloadPathForGame, knownGames } from '../../util/selectors';
import { currentGame, getSafe } from '../../util/storeHelper';
import { decodeHTML, truthy } from '../../util/util';

import { ICategoryDictionary } from '../category_management/types/ICategoryDictionary';
import { DownloadIsHTML } from '../download_management/DownloadManager';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { IMod } from '../mod_management/types/IMod';

import { setUserAPIKey } from './actions/account';
import { setNewestVersion } from './actions/persistent';
import { setLoginId } from './actions/session';
import { setAssociatedWithNXMURLs } from './actions/settings';
import { accountReducer } from './reducers/account';
import { persistentReducer } from './reducers/persistent';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';
import { nexusGameId, convertNXMIdReverse } from './util/convertGameId';
import retrieveCategoryList from './util/retrieveCategories';
import DashboardBanner from './views/DashboardBanner';
import GoPremiumDashlet from './views/GoPremiumDashlet';
import LoginDialog from './views/LoginDialog';
import LoginIcon from './views/LoginIcon';
import { } from './views/Settings';

import { genEndorsedAttribute, genGameAttribute, genModIdAttribute } from './attributes';
import * as eh from './eventHandlers';
import NXMUrl from './NXMUrl';
import * as sel from './selectors';
import { processErrorMessage, startDownload, nexusGames, endorseModImpl, updateKey } from './util';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fuzz from 'fuzzball';
import * as I18next from 'i18next';
import NexusT, { IDownloadURL, TimeoutError, NexusError } from 'nexus-api';
import * as path from 'path';
import * as React from 'react';
import { Button } from 'react-bootstrap';
import {} from 'uuid';
import * as WebSocket from 'ws';

let nexus: NexusT;

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
          if (nexusGames().find(game => game.domain_name === nexusId) === undefined) {
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
          if (err.code === 'ESOCKETTIMEOUT') {
            api.sendNotification({
              type: 'warning',
              message: 'Timeout retrieving categories from server, please try again later.',
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
  } catch(err) {
    // odd, still unidentified bugs where bundled modules fail to load. 
    log('warn', 'failed to import uuid module', err.message);
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.apply(null, Array(10)).map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
    // the probability that this fails for another user at exactly the same time and they both get the same
    // random number is practically 0
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

  let loginMessage: INexusLoginMessage = {
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
        }
        connection.send(JSON.stringify(loginMessage), err => {
          api.store.dispatch(setLoginId(loginMessage.id));
          if (err) {
            api.showErrorNotification('Failed to start login', err);
            connection.close();
          }
        });
        // open the authorization page - but not on reconnects!
        if (loginMessage.token === undefined) {
          opn(`https://www.nexusmods.com/sso?id=${loginMessage.id}`).catch(err => undefined);
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
            api.store.dispatch(setLoginId(undefined));
            cancelLogin = undefined;
            bringToFront();
            if (error !== undefined) {
              callback(error);
            } else {
              let error = new ProcessCanceled(`Log-in connection closed prematurely (Code ${code})`);
              error.stack = stackErr.stack;
              callback(error);
            }
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
        error = err;
        connection.close();
      });
  }

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

function once(api: IExtensionApi) {
  const registerFunc = (def?: boolean) => {
    if (def === undefined) {
      api.store.dispatch(setAssociatedWithNXMURLs(true));
    }

    if (api.registerProtocol('nxm', def !== false, (url: string) => {
      ensureLoggedIn(api)
        .then(() => {
          doDownload(api, url);
        })
        .catch(UserCanceled, () => null)
        .catch(ProcessCanceled, err => {
          api.showErrorNotification('Log-in failed', err, { allowReport: false });
        })
        .catch(err => {
          api.showErrorNotification('Failed to get access key', err);
        });
    })) {
      api.sendNotification({
        type: 'info',
        message: 'Vortex will now handle Nexus Download links',
        actions: [
          { title: 'More', action: () => {
            api.showDialog('info', 'Download link handling', {
              text: 'Only one application can be set up to handle Nexus "Mod Manager Download" links, Vortex is now '
                  + 'registered to do that.\n\n'
                  + 'To use a different application for these links, please go to Settings->Downloads, disable '
                  + 'the "Handle Nexus Links" option, then go to the application you do want to handle the links '
                  + 'and enable the corresponding option there.',
            }, [
              { label: 'Close' },
            ]);
          } },
        ]
      });
    };
  };

  { // limit lifetime of state
    const state = api.store.getState();

    const Nexus: typeof NexusT = require('nexus-api').default;
    const apiKey = getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], undefined);
    const gameMode = activeGameId(state);

    nexus = new Nexus(remote.app.getVersion(), gameMode, 30000);

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
  api.onStateChange(['persistent', 'downloads', 'files'], eh.onChangeDownloads(api, nexus))

  nexus.getModInfo(1, 'site')
    .then(info => {
      api.store.dispatch(setNewestVersion(info.version));
    })
    .catch(err => {
      // typically just missing the api key or a downtime
      log('info', 'failed to determine newest Vortex version', { error: err.message });
    });
}

function toolbarBanner(t: I18next.TranslationFunction): React.StatelessComponent<any> {
  return () => {
    return (<div className='nexus-main-banner' style={{ background: 'url(assets/images/ad-banner.png)' }}>
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

  instanceIds.map(dlId => {
    const dl = state.persistent.downloads.files[dlId];
    const gameId = Array.isArray(dl.game) ? dl.game[0] : dl.game;
    const downloadPath = downloadPathForGame(state, gameId);
    if ((downloadPath === undefined) || (dl.localPath === undefined)) {
      // almost certainly dl.localPath is undefined with a bugged download
      return;
    }
    api.lookupModMeta({
      fileMD5: dl.fileMD5,
      filePath: path.join(downloadPath, dl.localPath),
      gameId,
      fileSize: dl.size,
    })
    .then((modInfo: ILookupResult[]) => {
      if (modInfo.length > 0) {
        try {
          const nxmUrl = new NXMUrl(modInfo[0].value.sourceURI);
          api.store.dispatch(setDownloadModInfo(dlId, 'source', 'nexus'));
          api.store.dispatch(setDownloadModInfo(dlId, 'nexus.ids.gameId', nxmUrl.gameId));
          api.store.dispatch(setDownloadModInfo(dlId, 'nexus.ids.fileId', nxmUrl.fileId));
          api.store.dispatch(setDownloadModInfo(dlId, 'nexus.ids.modId', nxmUrl.modId));
        } catch (err) {
          // failed to parse the uri as an nxm link - that's not an error in this case, if
          // the meta server wasn't nexus mods this is to be expected
        }
      }
    })
    .catch(err => {
      log('warn', 'failed to look up mod meta info', { message: err.message });
    });
  });
}

function init(context: IExtensionContextExt): boolean {
  context.registerAction('application-icons', 200, LoginIcon, {}, () => ({ nexus }));
  context.registerAction('mods-action-icons', 999, 'open-ext', {}, 'Open on Nexus Mods', instanceIds => {
    const state: IState = context.api.store.getState();
    const gameMode = activeGameId(state);
    const mod: IMod = getSafe(state.persistent.mods, [gameMode, instanceIds[0]], undefined);
    if (mod !== undefined) {
      const gameId = mod.attributes.downloadGame !== undefined ? mod.attributes.downloadGame : gameMode;
      context.api.events.emit('open-mod-page', gameId, mod.attributes.modId);
    }
  }, instanceIds => {
    const state: IState = context.api.store.getState();
    const gameMode = activeGameId(state);
    return getSafe(state.persistent.mods, [gameMode, instanceIds[0], 'attributes', 'source'], undefined) === 'nexus';
  });
  context.registerAction('downloads-action-icons', 100, 'refresh', {}, 'Query Info',
    (instanceIds: string[]) => queryInfo(context.api, instanceIds));
  context.registerAction('downloads-multirow-actions', 100, 'refresh', {}, 'Query Info',
    (instanceIds: string[]) => queryInfo(context.api, instanceIds));

  // this makes it so the download manager can use nxm urls as download urls
  context.registerDownloadProtocol('nxm', (input: string): Promise<{ urls: string[], meta: any }> => {
    const state = context.api.store.getState();

    let url: NXMUrl;
    try {
      url = new NXMUrl(input);
    } catch (err) {
      return Promise.reject(err);
    }

    const games = knownGames(state);
    const gameId = convertNXMIdReverse(games, url.gameId);
    const pageId = nexusGameId(gameById(state, gameId));
    return Promise.resolve().then(() => nexus.getDownloadURLs(url.modId, url.fileId, url.key, url.expires, pageId))
      .then((res: IDownloadURL[]) => ({ urls: res.map(url => url.URI), meta: {} }))
      .catch(NexusError, err => {
        const newError = new HTTPError(err.statusCode, err.message, err.request);
        newError.stack = err.stack;
        return Promise.reject(newError);
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
    }
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

  context.registerAction('download-icons', 100, InputButton, {},
    () => ({
      key: 'input-nxm-url',
      id: 'input-nxm-url',
      groupId: 'download-buttons',
      icon: 'nexus',
      tooltip: 'Download NXM URL',
      onConfirmed: (nxmurl: string) => startDownload(context.api, nexus, nxmurl),
    }));

  context.registerAction('categories-icons', 100, 'download', {}, 'Retrieve categories',
    () => retrieveCategories(context.api, true));

  context.registerTableAttribute('mods', genEndorsedAttribute(context.api,
    (gameId: string, modId: string, endorseStatus: string) => endorseModImpl(context.api, nexus, gameId, modId, endorseStatus)));
  context.registerTableAttribute('mods', genGameAttribute(context.api));
  context.registerTableAttribute('mods', genModIdAttribute(context.api));

  context.registerDashlet('Nexus Mods Account Banner', 3, 1, 0, DashboardBanner, undefined, undefined, {
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

  return true;
}

export default init;
