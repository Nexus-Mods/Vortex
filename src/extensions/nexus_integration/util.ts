import * as Promise from 'bluebird';
import { app as appIn, ipcRenderer, remote } from 'electron';
import * as I18next from 'i18next';
import Nexus, { IFileInfo, IGameListEntry, IModInfo, NexusError,
                RateLimitError, TimeoutError } from 'nexus-api';
import * as Redux from 'redux';
import * as semver from 'semver';
import * as util from 'util';
import { setModAttribute } from '../../actions';
import { IExtensionApi, IMod } from '../../types/api';
import { setApiKey } from '../../util/errorHandling';
import github, { RateLimitExceeded } from '../../util/github';
import { log } from '../../util/log';
import { calcDuration, prettifyNodeErrorMessage, showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';
import { gameById, knownGames } from '../gamemode_management/selectors';
import modName from '../mod_management/util/modName';
import { setUserInfo } from './actions/persistent';
import NXMUrl from './NXMUrl';
import { checkModVersion } from './util/checkModsVersion';
import { convertNXMIdReverse, nexusGameId } from './util/convertGameId';
import sendEndorseMod from './util/endorseMod';
import transformUserInfo from './util/transformUserInfo';

const UPDATE_CHECK_DELAY = 60 * 60 * 1000;

const app = remote !== undefined ? remote.app : appIn;

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
  const pageId = nexusGameId(gameById(state, gameId), url.gameId);

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
        api.events.emit('start-download', [nxmurl], {
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
      if (err.message === 'Provided key and expire time isn\'t correct for this user/file.') {
        const userName = getSafe(state, ['persistent', 'nexus', 'userInfo', 'name'], undefined);
        const t = api.translate;
        api.sendNotification({
          id: url.fileId.toString(),
          type: 'warning',
          title: 'Download failed',
          message: userName === undefined
            ? t('You need to be logged in to Nexus Mods.')
            : t('The link was not created for this account ({{ userName }}). You have to be logged '
                + 'into nexusmods.com with the same account that you use in Vortex.', {
            replace: {
              userName,
            },
          }),
          localize: {
            message: false,
          },
        });
      } else if (err instanceof RateLimitError) {
        api.sendNotification({
          id: 'rate-limit-exceeded',
          type: 'warning',
          title: 'Rate-limit exceeded',
          message: 'You wont be able to use network features until the next full hour.',
        });
      } else {
        api.sendNotification({
          id: url.fileId.toString(),
          type: 'global',
          title: 'Download failed',
          message: err.message,
          displayMS: 2000,
        });
      }
      log('warn', 'failed to get mod info', { err: util.inspect(err) });
      return undefined;
    });
}

interface IRequestError {
  message: string;
  Servermessage?: string;
  URL?: string;
  Game?: string;
  stack?: string;
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
      return { message: 'You are not logged in to Nexus Mods!', noReport: true };
    } else {
      const res: IRequestError = { message: errorMessage };
      if (err.stack !== undefined) {
        res.stack = err.stack;
      }
      return res;
    }
  } else if ((err.statusCode >= 400) && (err.statusCode < 500)) {
    return {
      message: 'Server couldn\'t process this request.\nMaybe the locally stored '
      + 'info about the mod is wrong\nor the mod was removed from Nexus.',
      Servermessage: errorMessage,
      URL: err.request,
      fatal: errorMessage === undefined,
    };
  } else if ((err.statusCode >= 500) && (err.statusCode < 600)) {
    return {
      message: 'The server reported an internal error. Please try again later.',
      Servermessage: errorMessage,
      URL: err.request,
      noReport: true,
    };
  } else {
    return {
      message: 'Unexpected error reported by the server',
      Servermessage: (errorMessage || '') + ' ( Status Code: ' + err.statusCode + ')',
      URL: err.request,
      stack: err.stack,
    };
  }
}

function resolveEndorseError(t: I18next.TranslationFunction, err: Error): string {
  if (err.message === 'You must provide a version') {
    // is this still reported in this way?
    return t('You can\'t endorse a mod that has no version set.');
  } else if ((err as any).statusCode === 403) {
    const msg = {
      NOT_DOWNLOADED_MOD: 'You have not downloaded this mod from Nexus Mods yet.',
      TOO_SOON_AFTER_DOWNLOAD: 'You have to wait 15 minutes after downloading a '
                             + 'mod before you can endorse it.',
      IS_OWN_MOD: 'You can\'t endorse your own mods.',
    }[err.message];
    if (msg !== undefined) {
      return t(msg);
    }
  }

  return undefined;
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
      const expectedError = resolveEndorseError(api.translate, err);
      if (expectedError !== undefined) {
        api.sendNotification({
          type: 'info',
          message: expectedError,
        });
      } else if (err instanceof TimeoutError) {
        const message = 'A timeout occurred trying to endorse the mod, please try again later.';
        api.sendNotification({
          type: 'error',
          title: 'Timeout',
          message,
          displayMS: calcDuration(message.length),
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

function nexusLink(mod: IMod, gameMode: string) {
  const gameId = getSafe(mod.attributes, ['downloadGame'], undefined) || gameMode;
  const nexusModId: number = parseInt(getSafe(mod.attributes, ['modId'], undefined), 10);
  return `https://www.nexusmods.com/${gameId}/mods/${nexusModId}`;
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

        if (detail.message === undefined) {
          return undefined;
        }

        const name = modName(mod, { version: true });
        const nameLink = `[url=${nexusLink(mod, gameId)}]${name}[/url]`;

        return (detail.Servermessage !== undefined)
          ? `${nameLink}:<br/>${detail.message}<br/>Server said: "${detail.Servermessage}"<br/>`
          : `${nameLink}:<br/>${detail.message}`;
      }), { concurrency: 4 })
    .then((errorMessages: string[]): string[] => errorMessages.filter(msg => msg !== undefined));
}

function errorFromNexusError(err: NexusError): string {
  switch (err.statusCode) {
    case 401: return 'Login was refused, please review your API key.';
    default: return err.message;
  }
}

export function updateKey(api: IExtensionApi, nexus: Nexus, key: string): Promise<void> {
  setApiKey(key);
  return Promise.resolve(nexus.setKey(key))
    .then(userInfo => {
      if (userInfo !== null) {
        api.store.dispatch(setUserInfo(transformUserInfo(userInfo)));
        retrieveNexusGames(nexus);
      }
      return github.fetchConfig('api');
    }).then(configObj => {
      const currentVer = app.getVersion();
      if ((currentVer !== '0.0.1')
          && (semver.lt(currentVer, configObj.minversion))) {
        (nexus as any).disable();
        api.sendNotification({
          type: 'warning',
          title: 'Vortex outdated',
          message: 'Your version of Vortex is quite outdated. Network features disabled.',
          actions: [
            { title: 'Check for update', action: () => {
              ipcRenderer.send('check-for-updates', 'stable');
            } },
          ],
        });
      }
    })
    // don't stop the login just because the github rate limit is exceeded
    .catch(RateLimitExceeded, () => Promise.resolve())
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
      const t = api.translate;
      const pretty = prettifyNodeErrorMessage(err);
      // if there is an "errno", this is more of a technical problem, like
      // network is offline or server not reachable
      api.sendNotification({
        type: 'error',
        title: err.code === 'ESOCKETTIMEDOUT' ? undefined : 'Failed to log in',
        message: err.code ===  'ESOCKETTIMEDOUT'
          ? t('Connection to nexusmods.com timed out, please check your internet connection')
          : t(pretty.message, { replace: pretty.replace }),
        actions: [
          { title: 'Retry', action: dismiss => { updateKey(api, nexus, key); dismiss(); } },
        ],
      });
      api.store.dispatch(setUserInfo(undefined));
    });
}

let nexusGamesCache: IGameListEntry[] = [];

export function retrieveNexusGames(nexus: Nexus) {
  nexus.getGames()
    .then(games => {
      nexusGamesCache = games.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
    })
    .catch(err => null);
}

export function nexusGames(): IGameListEntry[] {
  return nexusGamesCache;
}
