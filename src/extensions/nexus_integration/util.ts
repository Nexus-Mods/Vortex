import * as Promise from 'bluebird';
import Nexus, { IDownloadURL, IFileInfo, IGameListEntry, IModInfo, NexusError } from 'nexus-api';
import * as Redux from 'redux';
import * as util from 'util';
import { setModAttribute } from '../../actions';
import { IExtensionApi, IMod } from '../../types/api';
import { getSafe, showError } from '../../util/api';
import { log } from '../../util/log';
import { truthy } from '../../util/util';
import modName from '../mod_management/util/modName';
import { setUserInfo } from './actions/persistent';
import NXMUrl from './NXMUrl';
import { checkModVersion } from './util/checkModsVersion';
import { nexusGameId, convertNXMIdReverse, convertGameIdReverse } from './util/convertGameId';
import sendEndorseMod from './util/endorseMod';
import { TimeoutError } from './util/submitFeedback';
import transformUserInfo from './util/transformUserInfo';
import { gameById, knownGames } from '../gamemode_management/selectors';
import { activeGameId } from '../../util/selectors';

const UPDATE_CHECK_DELAY = 60 * 60 * 1000;

export function startDownload(api: IExtensionApi, nexus: Nexus, nxmurl: string): Promise<string> {
  let url: NXMUrl;

  try {
    url = new NXMUrl(nxmurl);
  } catch (err) {
    return Promise.reject(err);
  }

  let nexusModInfo: IModInfo;
  let nexusFileInfo: IFileInfo;

  const state = api.store.getState();
  const games = knownGames(state);
  const gameId = convertNXMIdReverse(games, url.gameId);
  const pageId = nexusGameId(gameById(state, gameId));

  return Promise.resolve(nexus.getModInfo(url.modId, pageId))
    .then((modInfo: IModInfo) => {
      nexusModInfo = modInfo;
      return nexus.getFileInfo(url.modId, url.fileId, pageId);
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
      return new Promise<string>((resolve, reject) => {
        api.events.emit('start-download',
          () => Promise.resolve(nexus.getDownloadURLs(url.modId, url.fileId, pageId))
                    .map((res: IDownloadURL) => res.URI), {
          game: gameId,
          source: 'nexus',
          name: nexusFileInfo.name,
          nexus: {
            ids: { gameId: pageId, modId: url.modId, fileId: url.fileId },
            modInfo: nexusModInfo,
            fileInfo: nexusFileInfo,
          },
        },
        nexusFileInfo.file_name,
        (err, downloadId) => (truthy(err)
          ? reject(err)
          : resolve(downloadId)));
      });
    })
    .then(downloadId => {
      api.sendNotification({
        id: `ready-to-install-${downloadId}`,
        type: 'success',
        title: api.translate('Download finished'),
        group: 'download-finished',
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
      return undefined;
    });
}

interface IRequestError {
  Error: string;
  Servermessage?: string;
  URL?: string;
  Game?: string;
  fatal?: boolean;
  Mod?: number;
  Version?: string;
  noReport?: boolean;
}

export function processErrorMessage(err: NexusError): IRequestError {
  const errorMessage = typeof(err) === 'string' ? err : err.message;
  if (err.statusCode === undefined) {
    if (errorMessage
      && ((errorMessage.indexOf('APIKEY') !== -1)
          || (errorMessage.indexOf('API Key') !== -1))) {
      return { Error: 'You are not logged in to Nexus Mods!', noReport: true };
    } else {
      return { Error: errorMessage };
    }
  } else if ((err.statusCode >= 400) && (err.statusCode < 500)) {
    return {
      Error: 'Server couldn\'t process this request.\nMaybe the locally stored '
      + 'info about the mod is wrong\nor the mod was removed from Nexus.',
      Servermessage: errorMessage,
      URL: err.request,
      fatal: errorMessage === undefined,
    };
  } else if ((err.statusCode >= 500) && (err.statusCode < 600)) {
    return {
      Error: 'The server reported an internal error. Please try again later.',
      Servermessage: errorMessage,
      URL: err.request,
    };
  } else {
    return {
      Error: 'Unexpected error reported by the server',
      Servermessage: (errorMessage || '') + ' ( Status Code: ' + err.statusCode + ')',
      URL: err.request,
    };
  }
}

export function endorseModImpl(
  api: IExtensionApi,
  nexus: Nexus,
  gameId: string,
  modId: string,
  endorsedStatus: string) {
  const { store } = api;
  const gameMode = activeGameId(store.getState());
  const mod: IMod = getSafe(store.getState(), ['persistent', 'mods', gameMode, modId], undefined);

  if (mod === undefined) {
    log('warn', 'tried to endorse unknown mod', { gameId, modId });
    return;
  }

  const APIKEY = getSafe(store.getState(),
    ['confidential', 'account', 'nexus', 'APIKey'], '');
  if (APIKEY === '') {
    showError(store.dispatch,
      'An error occurred endorsing a mod',
      'You are not logged in to Nexus Mods!', { allowReport: false });
    return;
  }

  const nexusModId: number = parseInt(getSafe(mod.attributes, ['modId'], '0'), 10);
  const version: string = getSafe(mod.attributes, ['version'], undefined)
                        || getSafe(mod.attributes, ['modVersion'], undefined);

  if (!truthy(version)) {
    api.sendNotification({
      type: 'info',
      message: api.translate('You can\'t endorse a mod that has no version set.'),
    });
    return;
  }

  store.dispatch(setModAttribute(gameId, modId, 'endorsed', 'pending'));
  const game = gameById(api.store.getState(), gameId);
  sendEndorseMod(nexus, nexusGameId(game), nexusModId, version, endorsedStatus)
    .then((endorsed: string) => {
      store.dispatch(setModAttribute(gameMode, modId, 'endorsed', endorsed));
    })
    .catch((err) => {
      store.dispatch(setModAttribute(gameMode, modId, 'endorsed', 'Undecided'));
      if (err.message === 'You must provide a version') {
        api.sendNotification({
          type: 'info',
          message: api.translate('You can\'t endorse a mod that has no version set.'),
        });
      } else {
        const detail = processErrorMessage(err);
        detail.Game = gameId;
        detail.Mod = nexusModId;
        detail.Version = version;
        let allowReport = detail.Servermessage === undefined;
        if (detail.noReport) {
          allowReport = false;
          delete detail.noReport;
        }
        showError(store.dispatch, 'An error occurred endorsing a mod', detail,
                  { allowReport });
      }
    });
}

export function checkModVersionsImpl(
  store: Redux.Store<any>,
  nexus: Nexus,
  gameId: string,
  mods: { [modId: string]: IMod }): Promise<string[]> {

  const now = Date.now();

  const modsList: IMod[] = Object.keys(mods)
    .map(modId => mods[modId])
    .filter(mod => getSafe(mod.attributes, ['source'], undefined) === 'nexus')
    .filter(mod =>
      (now - (getSafe(mod.attributes, ['lastUpdateTime'], 0) || 0)) > UPDATE_CHECK_DELAY)
    ;

  log('info', 'checking mods for update (nexus)', { count: modsList.length });
  const {TimeoutError} = require('nexus-api');

  return Promise.map(modsList, mod =>
    checkModVersion(store, nexus, gameId, mod)
      .then(() => {
        store.dispatch(setModAttribute(gameId, mod.id, 'lastUpdateTime', now));
      })
      .catch(TimeoutError, err => {
        const name = modName(mod, { version: true });
        return Promise.resolve(`${name}:\nRequest timeout`);
      })
      .catch(err => {
        const detail = processErrorMessage(err);
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
    .then((errorMessages: string[]): string[] => errorMessages.filter(msg => msg !== undefined));
}

function errorFromNexusError(err: NexusError): string {
  switch (err.statusCode) {
    case 401: return 'Login was refused, please review your API key.';
    default: return err.message;
  }
}

export function validateKey(api: IExtensionApi, nexus: Nexus, key: string): Promise<void> {
  return Promise.resolve(nexus.validateKey(key))
    .then(userInfo => {
      api.store.dispatch(setUserInfo(transformUserInfo(userInfo)));
      retrieveNexusGames(nexus);
    })
    .catch(TimeoutError, () => {
      showError(api.store.dispatch,
        'API Key validation timed out',
        'Server didn\'t respond to validation request, web-based '
        + 'features will be unavailable', { allowReport: false });
      api.store.dispatch(setUserInfo(undefined));
    })
    .catch(NexusError, err => {
      showError(api.store.dispatch,
        'Failed to log in',
        errorFromNexusError(err), { allowReport: false });
      api.store.dispatch(setUserInfo(undefined));
    })
    .catch(err => {
      // if there is an "errno", this is more of a technical problem, like
      // network is offline or server not reachable
      if (err.code === 'ESOCKETTIMEDOUT') {
        api.sendNotification({
          type: 'error',
          message: 'Connection to nexusmods.com timed out, please check your internet connection',
          actions: [
            { title: 'Retry', action: dismiss => { validateKey(api, nexus, key); dismiss(); } },
          ],
        });
        showError(api.store.dispatch,
          'Connection to Nexus API timed out, please check your internet connection',
          undefined, { allowReport: false });
      } else {
        showError(api.store.dispatch,
          'Failed to log in',
          err.message, { allowReport: false });
      }
      api.store.dispatch(setUserInfo(undefined));
    });
}

let nexusGamesCache: IGameListEntry[] = [];

export function retrieveNexusGames(nexus: Nexus) {
  nexus.getGames()
    .then(games => {
      nexusGamesCache = games.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
    })
    .catch(err => {
      nexusGamesCache = [];
    });
}

export function nexusGames(): IGameListEntry[] {
  return nexusGamesCache;
}
