import { IDialogResult, showDialog } from '../../actions/notifications';
import { setDialogVisible } from '../../actions/session';
import Icon from '../../controls/Icon';
import InputButton from '../../controls/InputButton';
import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { IState } from '../../types/IState';
import { ITableAttribute } from '../../types/ITableAttribute';
import Debouncer from '../../util/Debouncer';
import LazyComponent from '../../util/LazyComponent';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import { currentGame, getSafe } from '../../util/storeHelper';
import { decodeHTML, truthy } from '../../util/util';

import { ICategoryDictionary } from '../category_management/types/IcategoryDictionary';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { setModAttribute } from '../mod_management/actions/mods';
import { setUpdatingMods } from '../mod_management/actions/settings';
import { IMod } from '../mod_management/types/IMod';
import modName from '../mod_management/util/modName';
import { IProfileMod } from '../profile_management/types/IProfile';

import { setUserAPIKey } from './actions/account';
import { setUserInfo } from './actions/session';
import { setAssociatedWithNXMURLs } from './actions/settings';
import { accountReducer } from './reducers/account';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';
import { checkModVersion, retrieveModInfo } from './util/checkModsVersion';
import { convertGameId, toNXMId } from './util/convertGameId';
import sendEndorseMod from './util/endorseMod';
import retrieveCategoryList from './util/retrieveCategories';
import submitFeedback from './util/submitFeedback';
import transformUserInfo from './util/transformUserInfo';
import DashboardBanner from './views/DashboardBanner';
import EndorsementFilter from './views/EndorsementFilter';
import EndorseModButton from './views/EndorseModButton';
import LoginDialog from './views/LoginDialog';
import LoginIcon from './views/LoginIcon';
import NexusModIdDetail from './views/NexusModIdDetail';
import { } from './views/Settings';

import NXMUrl from './NXMUrl';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as I18next from 'i18next';
import NexusT, { IDownloadURL, IFileInfo, IModInfo, NexusError as NexusErrorT } from 'nexus-api';
import * as opn from 'opn';
import * as path from 'path';
import * as React from 'react';
import { Button } from 'react-bootstrap';
import { Interpolate } from 'react-i18next';
import * as Redux from 'redux';
import * as util from 'util';

type IModWithState = IMod & IProfileMod;

let nexus: NexusT;
let endorseMod: (gameId: string, modId: string, endorsedState: string) => void;

export interface IExtensionContextExt extends IExtensionContext {
  registerDownloadProtocol: (
    schema: string,
    handler: (inputUrl: string) => Promise<string[]>) => void;
}

function startDownload(api: IExtensionApi, nxmurl: string): Promise<string> {
  const url: NXMUrl = new NXMUrl(nxmurl);

  let nexusModInfo: IModInfo;
  let nexusFileInfo: IFileInfo;

  const gameId = convertGameId(url.gameId);

  return nexus.getModInfo(url.modId, gameId)
    .then((modInfo: IModInfo) => {
      nexusModInfo = modInfo;
      return nexus.getFileInfo(url.modId, url.fileId, gameId);
    })
    .then((fileInfo: IFileInfo) => {
      nexusFileInfo = fileInfo;
      api.sendNotification({
        id: url.fileId.toString(),
        type: 'global',
        title: 'Downloading from Nexus',
        message: fileInfo.name,
        displayMS: 4000,
      });
      return nexus.getDownloadURLs(url.modId, url.fileId, gameId);
    })
    .then((urls: IDownloadURL[]) => {
      if (urls === null) {
        throw { message: 'No download locations (yet)' };
      }
      const uris: string[] = urls.map((item: IDownloadURL) => item.URI);
      log('debug', 'got download urls', { uris });
      return new Promise<string>((resolve, reject) => {
        api.events.emit('start-download', uris, {
          game: url.gameId.toLowerCase(),
          source: 'nexus',
          name: nexusFileInfo.name,
          nexus: {
            ids: { gameId, modId: url.modId, fileId: url.fileId },
            modInfo: nexusModInfo,
            fileInfo: nexusFileInfo,
          },
        }, (err, downloadId) => {
          if (err) {
            return reject(err);
          }
          return resolve(downloadId);
        });
      });
    })
    .then(downloadId => {
      api.sendNotification({
        id: url.fileId.toString(),
        type: 'success',
        title: api.translate('Download finished'),
        message: nexusFileInfo.name,
        actions: [
          {
            title: 'Install', action: dismiss => {
              api.events.emit('start-install-download', downloadId);
              dismiss();
            },
          },
        ],
      });
      return downloadId;
    })
    .catch((err) => {
      api.sendNotification({
        id: url.fileId.toString(),
        type: 'global',
        title: 'Download failed',
        message: err.message,
        displayMS: 2000,
      });
      log('warn', 'failed to get mod info', { err: util.inspect(err) });
    });
}

function retrieveCategories(api: IExtensionApi, isUpdate: boolean) {
  let askUser: Promise<boolean>;
  if (isUpdate) {
    askUser = api.store.dispatch(
      showDialog('question', 'Retrieve Categories', {
        message: 'Clicking RETRIEVE you will lose all your changes',
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
    if (APIKEY === '') {
      showError(api.store.dispatch,
        'An error occurred retrieving categories',
        'You are not logged in!');
    } else {

      let gameId;
      currentGame(api.store)
        .then((game: IGameStored) => {
          gameId = game.id;
          log('info', 'retrieve categories for game', gameId);
          return retrieveCategoryList(convertGameId(gameId), nexus);
        })
        .then((categories: ICategoryDictionary) => {
          api.events.emit('retrieve-categories', gameId, categories, isUpdate);
        })
        .catch((err) => {
          if (err.code === 'ESOCKETTIMEOUT') {
            api.sendNotification({
              type: 'warning',
              message: 'Timeout retrieving categories from server, please try again later.',
            });
            return;
          }

          const errMessage = typeof(err) === 'string' ? err : err.message;
          const message = processErrorMessage(err.statusCode, errMessage);
          showError(api.store.dispatch,
            'An error occurred retrieving categories', message);
        });
    }
  });
}

// TODO: the field names in this object will be shown to the user, hence the capitalization
interface IRequestError {
  Error: string;
  Servermessage?: string;
  Game?: string;
  fatal?: boolean;
  Mod?: number;
  Version?: string;
}

function processErrorMessage(statusCode: number, errorMessage: string): IRequestError {
  if (statusCode === undefined) {
    if (errorMessage && (errorMessage.indexOf('APIKEY') > -1)) {
      return { Error: 'You are not logged in!' };
    } else {
      return { Error: errorMessage };
    }
  } else if ((statusCode >= 400) && (statusCode < 500)) {
    return {
      Error: 'Server couldn\'t process this request.\nMaybe the locally stored '
      + 'info about the mod is wrong\nor the mod was removed from Nexus.',
      Servermessage: errorMessage,
      fatal: errorMessage === undefined,
    };
  } else if ((statusCode >= 500) && (statusCode < 600)) {
    return {
      Error: 'The server reported an internal error. Please try again later.',
      Servermessage: errorMessage,
    };
  } else {
    return {
      Error: 'Unexpected error reported by the server',
      Servermessage: (errorMessage || '') + ' ( Status Code: ' + statusCode + ')',
    };
  }
}

function endorseModImpl(
  api: IExtensionApi,
  gameId: string,
  modId: string,
  endorsedStatus: string) {
  const { store } = api;
  const mod: IMod = getSafe(store.getState(), ['persistent', 'mods', gameId, modId], undefined);

  if (mod === undefined) {
    log('warn', 'tried to endorse unknown mod', { gameId, modId });
    return;
  }

  const APIKEY = getSafe(store.getState(),
    ['confidential', 'account', 'nexus', 'APIKey'], '');
  if (APIKEY === '') {
    showError(store.dispatch,
      'An error occurred endorsing a mod',
      'You are not logged in!');
    return;
  }

  const nexusModId: number = parseInt(getSafe(mod.attributes, ['modId'], '0'), 10);
  const version: string = getSafe(mod.attributes, ['version'], undefined);

  if (!truthy(version)) {
    api.sendNotification({
      type: 'info',
      message: api.translate('You can\'t endorse a mod that has no version set.'),
    });
    return;
  }

  store.dispatch(setModAttribute(gameId, modId, 'endorsed', 'pending'));
  sendEndorseMod(nexus, convertGameId(gameId), nexusModId, version, endorsedStatus)
    .then((endorsed: string) => {
      store.dispatch(setModAttribute(gameId, modId, 'endorsed', endorsed));
    })
    .catch((err) => {
      store.dispatch(setModAttribute(gameId, modId, 'endorsed', 'Undecided'));
      if (err.message === 'You must provide a version') {
        api.sendNotification({
          type: 'info',
          message: api.translate('You can\'t endorse a mod that has no version set.'),
        });
      } else {
        const detail = processErrorMessage(err.statusCode, err.message);
        detail.Game = gameId;
        detail.Mod = nexusModId;
        detail.Version = version;
        showError(store.dispatch, 'An error occurred endorsing a mod', detail);
      }
    });
}

function checkModVersionsImpl(
  store: Redux.Store<any>,
  gameId: string,
  mods: { [modId: string]: IMod }): Promise<string[]> {

  const modsList = Object.keys(mods)
    .map(modId => mods[modId])
    .filter(mod => mod.attributes.source === 'nexus');

  const {TimeoutError} = require('nexus-api');

  return Promise.map(modsList, mod =>
    checkModVersion(store.dispatch, nexus, gameId, mod)
      .catch(TimeoutError, err => {
        const name = modName(mod, { version: true });
        return Promise.resolve(`${name}:\nRequest timeout`);
      })
      .catch(err => {
        const detail = processErrorMessage(err.statusCode, err.message);
        if (detail.fatal) {
          return Promise.reject(detail);
        }

        if (detail.Error === undefined) {
          return undefined;
        }

        const name = modName(mod, { version: true });
        return (detail.Servermessage !== undefined)
          ? `${name}:\n${detail.Error}\nServer said: "${detail.Servermessage}"`
          : `${name}:\n${detail.Error}`;
      }), { concurrency: 4 })
    .then(errorMessages => errorMessages.filter(msg => msg !== undefined));
}

function renderNexusModIdDetail(
  store: Redux.Store<any>,
  mod: IModWithState,
  t: I18next.TranslationFunction) {
  const nexusModId: string = getSafe(mod.attributes, ['modId'], undefined);
  const fileName: string = getSafe(mod.attributes, ['name'], undefined);
  const gameMode = activeGameId(store.getState());
  const fileGameId = getSafe(mod.attributes, ['downloadGame'], undefined)
                  || gameMode;
  return (
    <NexusModIdDetail
      modId={mod.id}
      nexusModId={nexusModId}
      activeGameId={gameMode}
      fileGameId={fileGameId}
      fileName={fileName}
      isDownload={mod.state === 'downloaded'}
      t={t}
      store={store}
    />
  );
}

function createEndorsedIcon(store: Redux.Store<any>, mod: IMod, t: I18next.TranslationFunction) {
  const nexusModId: string = getSafe(mod.attributes, ['modId'], undefined);
  const version: string = getSafe(mod.attributes, ['version'], undefined);
  const state: string = getSafe(mod, ['state'], undefined);

  // TODO: this is not a reliable way to determine if the mod is from nexus
  const isNexusMod: boolean = (nexusModId !== undefined)
    && (version !== undefined)
    && !isNaN(parseInt(nexusModId, 10));

  let endorsed: string = getSafe(mod.attributes, ['endorsed'], undefined);
  if ((endorsed === undefined && state === 'installing')
   || (endorsed === undefined && isNexusMod)) {
    endorsed = 'Undecided';
  }
  const gameMode = getSafe(mod.attributes, ['downloadGame'], undefined)
                || activeGameId(store.getState());
  if (endorsed !== undefined) {
    return (
      <EndorseModButton
        endorsedStatus={endorsed}
        t={t}
        gameId={gameMode}
        modId={mod.id}
        onEndorseMod={endorseMod}
      />
    );
  }

  return null;
}

function openNexusPage(games: string[]) {
  opn(`http://www.nexusmods.com/${convertGameId(games[0])}`);
}

function processAttributes(input: any) {
  const nexusChangelog = getSafe(input.nexus, ['fileInfo', 'changelog_html'], undefined);

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
    logicalFileName: decodeHTML(getSafe(input, ['download', 'modInfo', 'nexus',
                                                'fileInfo', 'name'], undefined)),
    changelog: truthy(nexusChangelog) ? { format: 'html', content: nexusChangelog } : undefined,
    uploadedTimestamp: getSafe(input, ['download', 'modInfo', 'nexus',
                                       'fileInfo', 'uploaded_timestamp'], undefined),
    version: getSafe(input, ['download', 'modInfo', 'nexus', 'fileInfo', 'version'], undefined),
  });
}

function genEndorsedAttribute(api: IExtensionApi): ITableAttribute {
  return {
    id: 'endorsed',
    name: 'Endorsed',
    description: 'Endorsement state on Nexus',
    icon: 'star',
    customRenderer: (mod: IMod, detail: boolean, t: I18next.TranslationFunction) =>
      mod.attributes['source'] === 'nexus'
        ? createEndorsedIcon(api.store, mod, t)
        : null,
    calc: (mod: IMod) =>
      mod.attributes['source'] === 'nexus'
        ? getSafe(mod.attributes, ['endorsed'], null)
        : undefined,
    placement: 'table',
    isToggleable: true,
    edit: {},
    isSortable: true,
    filter: new EndorsementFilter(),
  };
}

function genModIdAttribute(api: IExtensionApi): ITableAttribute {
  return {
    id: 'nexusModId',
    name: 'Nexus Mod ID',
    description: 'Internal ID used by www.nexusmods.com',
    icon: 'external-link',
    customRenderer: (mod: IModWithState, detail: boolean, t: I18next.TranslationFunction) => {
      const res = mod.attributes['source'] === 'nexus'
        ? renderNexusModIdDetail(api.store, mod, t)
        : null;
      return res;
    },
    calc: (mod: IMod) =>
      mod.attributes['source'] === 'nexus'
        ? getSafe(mod.attributes, ['modId'], null)
        : undefined
    ,
    placement: 'detail',
    isToggleable: false,
    edit: {},
    isSortable: false,
    isVolatile: true,
  };
}

function errorFromNexusError(err: NexusErrorT): string {
  switch (err.statusCode) {
    case 401: return 'Login was refused, please review your API key.';
    default: return err.message;
  }
}

function validateKey(api: IExtensionApi, key: string): Promise<void> {
  const state = api.store.getState();
  const { NexusError, TimeoutError } = require('nexus-api');

  return nexus.validateKey(key)
    .then(userInfo =>
      api.store.dispatch(setUserInfo(transformUserInfo(userInfo))))
    .catch(TimeoutError, err => {
      showError(api.store.dispatch,
        'API Key validation timed out',
        'Server didn\'t respond to validation request, web-based '
        + 'features will be unavailable', false, undefined, false);
      api.store.dispatch(setUserInfo(null));
    })
    .catch(NexusError, err => {
      showError(api.store.dispatch,
        'Failed to validate API Key',
        errorFromNexusError(err), false, undefined, false);
      api.store.dispatch(setUserInfo(null));
    })
    .catch(err => {
      // if there is an "errno", this is more of a technical problem, like
      // network is offline or server not reachable
      if (err.code === 'ESOCKETTIMEDOUT') {
        api.sendNotification({
          type: 'error',
          message: 'Connection to nexusmods.com timed out, please check your internet connection',
          actions: [
            { title: 'Retry', action: dismiss => { validateKey(api, key); dismiss(); } },
          ],
        });
        showError(api.store.dispatch,
          'Connection to Nexus API timed out, please check your internet connection',
          undefined, false, undefined, false);
      } else {
        showError(api.store.dispatch,
          'Failed to validate API Key',
          err.message, false, undefined, false);
      }
      api.store.dispatch(setUserInfo(null));
    });
}

function once(api: IExtensionApi) {
  const registerFunc = () => {
    api.registerProtocol('nxm', (url: string) => {
      startDownload(api, url);
    });
  };

  { // limit lifetime of state
    const state = api.store.getState();

    const Nexus: typeof NexusT = require('nexus-api').default;
    nexus = new Nexus(activeGameId(state),
      getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], ''), 30000);

    const gameMode = activeGameId(state);
    api.store.dispatch(setUpdatingMods(gameMode, false));

    endorseMod = (gameId: string, modId: string, endorsedStatus: string) =>
      endorseModImpl(api, gameId, modId, endorsedStatus);

    if (state.settings.nexus.associateNXM) {
      registerFunc();
    }

    if (state.confidential.account.nexus.APIKey !== undefined) {
      (window as any).requestIdleCallback(() => {
        validateKey(api, state.confidential.account.nexus.APIKey);
      });
    }
  }

  api.events.on('retrieve-category-list', (isUpdate: boolean) => {
    retrieveCategories(api, isUpdate);
  });

  api.events.on('check-mods-version', (gameId, mods) => {
    const APIKEY = getSafe(api.store.getState(),
      ['confidential', 'account', 'nexus', 'APIKey'], '');
    if (APIKEY === '') {
      showError(api.store.dispatch,
        'An error occurred checking for mod updates',
        'You are not logged in!');
    } else {
      api.store.dispatch(setUpdatingMods(gameId, true));
      checkModVersionsImpl(api.store, gameId, mods)
        .then((errorMessages: string[]) => {
          if (errorMessages.length !== 0) {
            showError(api.store.dispatch,
              'Checking for mod updates succeeded but there were errors',
              errorMessages.join('\n\n'), false, undefined, false);
          }
        })
        .catch(err => {
          showError(api.store.dispatch,
            'An error occurred checking for mod updates',
            err);
        })
        .finally(() => {
          api.store.dispatch(setUpdatingMods(gameId, false));
        });
    }
  });

  api.events.on('endorse-mod', (gameId, modId, endorsedStatus) => {
    const APIKEY = getSafe(api.store.getState(),
      ['confidential', 'account', 'nexus', 'APIKey'], '');
    if (APIKEY === '') {
      showError(api.store.dispatch,
        'An error occurred endorsing a mod',
        'You are not logged in!');
    } else {
      endorseModImpl(api, gameId, modId, endorsedStatus);
    }
  });

  api.events.on('submit-feedback',
    (message: string, feedbackFiles: string[],
     anonymous: boolean, callback: (err: Error) => void) => {
      submitFeedback(nexus, message, feedbackFiles, anonymous)
        .then(() => callback(null))
        .catch(err => callback(err));
    });

  api.events.on('gamemode-activated', (gameId: string) => {
    nexus.setGame(gameId);
  });

  api.events.on('mod-update', (gameId, modId, fileId) => {
    // TODO: Need some way to identify if this request is actually for a nexus mod
    const url = `nxm://${toNXMId(gameId)}/mods/${modId}/files/${fileId}`;
    const state: IState = api.store.getState();
    const downloads = state.persistent.downloads.files;

    // check if the file is already downloaded. If not, download before starting the install
    const existingId = Object.keys(downloads).find(downloadId =>
      getSafe(downloads,
        [downloadId, 'modInfo', 'nexus', 'ids', 'fileId'], undefined) === fileId);
    if (existingId !== undefined) {
      api.events.emit('start-install-download', existingId);
    } else {
      startDownload(api, url)
        .then(downloadId => {
          api.events.emit('start-install-download', downloadId);
        });
    }
  });

  api.events.on('open-mod-page', (gameId, modId) => {
    opn(['http://www.nexusmods.com',
      convertGameId(gameId), 'mods', modId,
    ].join('/'));
  });

  api.onStateChange(['settings', 'nexus', 'associateNXM'],
    (oldValue: boolean, newValue: boolean) => {
      log('info', 'associate', { oldValue, newValue });
      if (newValue === true) {
        registerFunc();
      } else {
        api.deregisterProtocol('nxm');
      }
    });

  api.onStateChange(['confidential', 'account', 'nexus', 'APIKey'],
    (oldValue: string, newValue: string) => {
      nexus.setKey(newValue);
      api.store.dispatch(setUserInfo(undefined));
      if (newValue !== undefined) {
        validateKey(api, newValue);
      }
    });

  interface IModTable {
    [gameId: string]: {
      [modId: string]: IMod,
    };
  }

  let lastModTable = api.store.getState().persistent.mods;
  let lastGameMode = activeGameId(api.store.getState());

  const updateDebouncer: Debouncer = new Debouncer(newModTable => {
    const state = api.store.getState();
    const gameMode = activeGameId(state);
    if (lastGameMode === undefined) {
      return;
    }
    if ((lastModTable[lastGameMode] !== newModTable[gameMode])
      && (lastModTable[lastGameMode] !== undefined)
      && (newModTable[gameMode] !== undefined)) {
      Object.keys(newModTable[gameMode]).forEach(modId => {
        if ((lastModTable[lastGameMode][modId] !== undefined)
          && (lastModTable[lastGameMode][modId].attributes['modId']
            !== newModTable[gameMode][modId].attributes['modId'])) {
          return retrieveModInfo(nexus, api.store,
            gameMode, newModTable[gameMode][modId], api.translate)
            .then(() => {
              lastModTable = newModTable;
              lastGameMode = gameMode;
            });
        }
      });
    } else {
      return Promise.resolve();
    }
  }, 2000);

  api.onStateChange(['persistent', 'mods'],
    (oldValue: IModTable, newValue: IModTable) =>
      updateDebouncer.schedule(undefined, newValue));
}

function goBuyPremium() {
  opn('https://rd.nexusmods.com/register/premium');
}

function init(context: IExtensionContextExt): boolean {
  context.registerAction('application-icons', 200, LoginIcon, {}, () => ({ nexus }));
  context.registerSettings('Download', LazyComponent('./views/Settings', __dirname));
  context.registerReducer(['confidential', 'account', 'nexus'], accountReducer);
  context.registerReducer(['settings', 'nexus'], settingsReducer);
  context.registerReducer(['session', 'nexus'], sessionReducer);
  context.registerDialog('login-dialog', LoginDialog, () => ({ nexus }));
  context.registerBanner('downloads', () => {
    const t = context.api.translate;
    return (
      <div className='nexus-download-banner'>
        {t('Nexus downloads are capped at 1MB/s - '
          + 'Go Premium for uncapped download speeds')}
        <Button bsStyle='ad' onClick={goBuyPremium}>{t('Buy Now')}</Button>
      </div>);
  }, {
    props: {
      isPremium: state => getSafe(state, ['session', 'nexus', 'userInfo', 'isPremium'], undefined),
    },
    condition: (props: any): boolean => props.isPremium === false,
  });

  context.registerBanner('main-toolbar', () => {
    const t = context.api.translate;
    return (
      <div className='nexus-main-banner' style={{ background: 'url(assets/images/ad-banner.png)' }}>
        <div>{t('Go Premium')}</div>
        <div>{t('Uncapped downloads, no adverts')}</div>
        <div>{t('Support Nexus Mods')}</div>
        <div className='right-center'>
          <Button bsStyle='ad' onClick={goBuyPremium}>{context.api.translate('Buy Now')}</Button>
        </div>
      </div>);
  }, {
    props: {
      isPremium: state => getSafe(state, ['session', 'nexus', 'userInfo', 'isPremium'], undefined),
    },
    condition: (props: any): boolean => props.isPremium === false,
  });

  const logInDialog = () => {
    context.api.store.dispatch(setDialogVisible('login-dialog'));
  };

  const associateNXM = () => {
    const state: any = context.api.store.getState();
    context.api.store.dispatch(setAssociatedWithNXMURLs(!state.settings.nexus.associateNXM));
  };

  context.registerModSource('nexus', 'Nexus Mods', () => {
    const gameMode = activeGameId(context.api.store.getState());
    opn(`http://www.nexusmods.com/${convertGameId(gameMode)}`);
  });

  context.registerToDo('nxm-associated', 'settings', () => ({
    associated: context.api.store.getState().settings.nexus.associateNXM,
  }), 'link', 'Handle Nexus Links', associateNXM, undefined, (t, props: any) =>
    <span>{props.associated ? t('Yes') : t('No')}</span>, undefined);

  context.registerDownloadProtocol('nxm:', (nxmurl: string): Promise<string[]> => {
    const nxm: NXMUrl = new NXMUrl(nxmurl);
    return nexus.getDownloadURLs(nxm.modId, nxm.fileId, convertGameId(nxm.gameId))
      .map((url: IDownloadURL): string => url.URI);
  });

  context.registerAction('download-icons', 100, InputButton, {},
    () => ({
      key: 'input-nxm-url',
      id: 'input-nxm-url',
      groupId: 'download-buttons',
      icon: 'nexus',
      tooltip: 'Download NXM URL',
      onConfirmed: (nxmurl: string) => startDownload(context.api, nxmurl),
    }));

  context.registerAction('categories-icons', 100, 'download', {}, 'Retrieve categories',
    () => retrieveCategories(context.api, true));

  context.registerTableAttribute('mods', genEndorsedAttribute(context.api));
  context.registerTableAttribute('mods', genModIdAttribute(context.api));

  context.registerDashlet('Nexus Account', 3, 1, 0, DashboardBanner, undefined, undefined, {
    fixed: true,
    closable: true,
  });

  context.registerAttributeExtractor(50, (input: any) => {
    return Promise.resolve(processAttributes(input));
  });

  context.registerAction('game-discovered-buttons', 120, 'nexus', {},
                         context.api.translate('Open Nexus Page'),
                         openNexusPage);

  context.registerAction('game-managed-buttons', 120, 'nexus', {},
                         context.api.translate('Open Nexus Page'),
                         openNexusPage);

  context.registerAction('game-undiscovered-buttons', 120, 'nexus', {},
                         context.api.translate('Open Nexus Page'),
                         openNexusPage);

  context.once(() => once(context.api));

  return true;
}

export default init;
