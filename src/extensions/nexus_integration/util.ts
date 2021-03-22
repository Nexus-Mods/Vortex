import Nexus, {
  EndorsedStatus, IEndorsement, IFileInfo, IGameListEntry, IModInfo,
  IRevision, IUpdateEntry, NexusError, RateLimitError, TimeoutError,
} from '@nexusmods/nexus-api';
import Promise from 'bluebird';
import { app as appIn, ipcRenderer, remote } from 'electron';
import { TFunction } from 'i18next';
import * as Redux from 'redux';
import * as semver from 'semver';
import * as util from 'util';
import { addNotification, dismissNotification, setExtensionEndorsed, setModAttribute } from '../../actions';
import { IExtensionApi, IMod, IState, ThunkStore } from '../../types/api';
import { HTTPError, ProcessCanceled, TemporaryError, UserCanceled } from '../../util/CustomErrors';
import { contextify, setApiKey } from '../../util/errorHandling';
import github, { RateLimitExceeded } from '../../util/github';
import { log } from '../../util/log';
import { calcDuration, prettifyNodeErrorMessage, showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { toPromise, truthy } from '../../util/util';
import { AlreadyDownloaded, DownloadIsHTML, RedownloadMode } from '../download_management/DownloadManager';
import { SITE_ID } from '../gamemode_management/constants';
import { gameById, knownGames } from '../gamemode_management/selectors';
import modName from '../mod_management/util/modName';
import { setUserInfo } from './actions/persistent';
import NXMUrl from './NXMUrl';
import { checkModVersion, fetchRecentUpdates, ONE_DAY, ONE_MINUTE } from './util/checkModsVersion';
import { convertGameIdReverse, convertNXMIdReverse, nexusGameId } from './util/convertGameId';
import sendEndorseMod from './util/endorseMod';
import { FULL_REVISION_INFO } from './util/graphQueries';
import transformUserInfo from './util/transformUserInfo';

const UPDATE_CHECK_DELAY = 60 * 60 * 1000;

const app = remote !== undefined ? remote.app : appIn;

export function startDownload(api: IExtensionApi,
                              nexus: Nexus,
                              nxmurl: string,
                              redownload?: RedownloadMode,
                              fileName?: string,
                              allowInstall?: boolean)
                              : Promise<string> {
  let url: NXMUrl;

  log('debug', 'start download', fileName);
  try {
    url = new NXMUrl(nxmurl);
  } catch (err) {
    return Promise.reject(err);
  }

  if ((['vortex', 'site'].includes(url.gameId)) && url.view) {
    api.events.emit('show-extension-page', url.modId);
    return Promise.reject(new DownloadIsHTML(nxmurl));
  }

  return (url.type === 'mod')
    ? startDownloadMod(api, nexus, nxmurl, url, redownload, fileName, allowInstall)
    : startDownloadCollection(api, nexus, nxmurl, url);
}

function startDownloadCollection(api: IExtensionApi,
                                 nexus: Nexus,
                                 urlStr: string,
                                 url: NXMUrl)
                                 : Promise<string> {
  const state: IState = api.getState();
  const games = knownGames(state);
  const gameId = convertNXMIdReverse(games, url.gameId);
  const pageId = nexusGameId(gameById(state, gameId), url.gameId);
  let revisionInfo: Partial<IRevision>;

  return Promise.resolve(nexus.getRevisionGraph(FULL_REVISION_INFO, url.revisionId))
    .then(revision => {
      revisionInfo = revision;
      api.sendNotification({
        id: revision.id.toString(),
        type: 'global',
        message: 'Downloading Collection',
        displayMS: 40000,
      });
      return nexus.getCollectionDownloadLink(revision.downloadLink)
    })
    .then(downloadUrls => {
      return toPromise<string>(cb => api.events.emit('start-download',
        downloadUrls.map(iter => iter.URI), {
        game: gameId,
        source: 'nexus',
        name: revisionInfo.collection?.name,
        nexus: {
          ids: { gameId: pageId, collectionId: url.collectionId, revisionId: url.revisionId },
          revisionInfo,
        },
      }, (revisionInfo as any).file_name, cb, undefined, false))
      .catch(err => Promise.reject(contextify(err)));
    })
    .tap(dlId => api.events.emit('did-download-collection', dlId));
}

export function getInfo(nexus: Nexus, domain: string, modId: number, fileId: number)
                        : Promise<{ modInfo: IModInfo, fileInfo: IFileInfo }> {
  return Promise.all([ nexus.getModInfo(modId, domain), nexus.getFileInfo(modId, fileId, domain) ])
    .then(([ modInfo, fileInfo ]) => ({modInfo, fileInfo}));
}

function startDownloadMod(api: IExtensionApi,
                          nexus: Nexus,
                          urlStr: string,
                          url: NXMUrl,
                          redownload?: RedownloadMode,
                          fileName?: string,
                          allowInstall?: boolean): Promise<string> {
  log('info', 'start download mod', { urlStr, allowInstall });
  const state = api.store.getState();
  const games = knownGames(state);
  const gameId = convertNXMIdReverse(games, url.gameId);
  const pageId = nexusGameId(gameById(state, gameId), url.gameId);

  let nexusFileInfo: IFileInfo;

  return getInfo(nexus, pageId, url.modId, url.fileId)
    .then(({ modInfo, fileInfo }) => {
      nexusFileInfo = fileInfo;
      api.sendNotification({
        id: url.fileId.toString(),
        type: 'global',
        title: 'Downloading from Nexus',
        message: fileInfo.name,
        displayMS: 4000,
      });
      return new Promise<string>((resolve, reject) => {
        api.events.emit('start-download', [urlStr], {
          game: gameId,
          source: 'nexus',
          name: fileInfo.name,
          nexus: {
            ids: { gameId: pageId, modId: url.modId, fileId: url.fileId },
            modInfo,
            fileInfo,
          },
        },
        fileName ?? nexusFileInfo.file_name,
        (err, downloadId) => (truthy(err)
          ? reject(contextify(err))
          : resolve(downloadId)),
        redownload, allowInstall);
      });
    })
    .then(downloadId => {
      if (gameId === SITE_ID) {
        return downloadId;
      }
      if (!state.settings.automation?.install) {
        api.sendNotification({
          id: `ready-to-install-${downloadId}`,
          type: 'success',
          title: 'Download finished',
          group: 'download-finished',
          message: nexusFileInfo.name,
          actions: [
            {
              title: 'Install All', action: dismiss => {
                api.events.emit('start-install-download', downloadId);
                dismiss();
              },
            },
          ],
        });
      }
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
      } else if (err instanceof NexusError) {
        const detail = processErrorMessage(err);
        let allowReport = detail.Servermessage === undefined;
        if (detail.noReport) {
          allowReport = false;
          delete detail.noReport;
        }
        showError(api.store.dispatch, 'Download failed', detail,
                  { allowReport });
      } else if (err instanceof HTTPError) {
        if (err.statusCode >= 400) {
          api.showErrorNotification('Download failed', err, { allowReport: false });
        } else {
          api.showErrorNotification('Download failed', {
            error: err,
            message: 'This may be a temporary issue, please try again later',
          }, { allowReport: false });
        }
      } else if (err instanceof TimeoutError) {
        api.showErrorNotification('Download failed', err, { allowReport: false });
      } else if (err instanceof ProcessCanceled) {
        api.showErrorNotification('Download failed', {
          error: err,
          message: 'This may be a temporary issue, please try again later',
        }, { allowReport: false });
      } else if ((err.message.indexOf('DECRYPTION_FAILED_OR_BAD_RECORD_MAC') !== -1)
              || (err.message.indexOf('WRONG_VERSION_NUMBER') !== -1)
              || (err.message.indexOf('BAD_SIGNATURE') !== -1)
              || (err.message.indexOf('TLSV1_ALERT_ACCESS_DENIED') !== -1)) {
        api.showErrorNotification('Download failed', {
          error: err,
          message: 'This may be a temporary issue, please try again later',
        }, { allowReport: false });
      } else if (err instanceof TemporaryError) {
        api.showErrorNotification('Download failed', {
          error: err,
          message: 'This may be a temporary issue, please try again later',
        }, { allowReport: false });
      } else if (err instanceof AlreadyDownloaded) {
        return err.downloadId;
      } else if (err instanceof UserCanceled) {
        // nop
      } else {
        const allowReport = (err['nativeCode'] === undefined)
                         || ([225].indexOf(err['nativeCode']) === -1);
        api.showErrorNotification('Download failed', err, { allowReport });
      }
      log('warn', 'failed to get mod info', { err: util.inspect(err) });
      return null;
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

function resolveEndorseError(t: TFunction, err: Error): string {
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

function reportEndorseError(api: IExtensionApi, err: Error,
                            gameId: string, modId: number, version: string) {
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
  } else if ((['ENOENT', 'ECONNRESET', 'ECONNABORTED', 'ESOCKETTIMEDOUT'].includes(err['code']))
      || (err instanceof ProcessCanceled)) {
    api.showErrorNotification('Endorsing mod failed, please try again later', err, {
      allowReport: false,
    });
  } else {
    const detail = processErrorMessage(err as NexusError);
    detail.Game = gameId;
    detail.Mod = modId;
    detail.Version = version;
    let allowReport = detail.Servermessage === undefined;
    if (detail.noReport) {
      allowReport = false;
      delete detail.noReport;
    }
    showError(api.store.dispatch, 'An error occurred endorsing a mod', detail,
      { allowReport });
  }
}

export function endorseDirectImpl(api: IExtensionApi, nexus: Nexus,
                                  gameId: string, nexusId: number, version: string,
                                  endorsedStatus: string): Promise<string> {
  return sendEndorseMod(nexus, gameId, nexusId, version, endorsedStatus)
    .catch(err => {
      reportEndorseError(api, err, gameId, nexusId, version);
      return endorsedStatus as EndorsedStatus;
    });
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
    .catch((err: Error | NexusError) => {
      store.dispatch(setModAttribute(gameMode, modId, 'endorsed', 'Undecided'));
      reportEndorseError(api, err, gameId, nexusModId, version);
    });
}

function nexusLink(state: IState, mod: IMod, gameMode: string) {
  const gameId = nexusGameId(
    gameById(state, getSafe(mod.attributes, ['downloadGame'], undefined) || gameMode));
  const nexusModId: number = parseInt(getSafe(mod.attributes, ['modId'], undefined), 10);
  return `https://www.nexusmods.com/${gameId}/mods/${nexusModId}`;
}

export function refreshEndorsements(store: Redux.Store<any>, nexus: Nexus) {
  return Promise.resolve(nexus.getEndorsements())
    .then(endorsements => {
      const endorseMap: { [gameId: string]: { [modId: string]: EndorsedStatus } } =
        endorsements.reduce((prev, endorsement: IEndorsement) => {
          const gameId = convertGameIdReverse(knownGames(store.getState()),
                                              endorsement.domain_name);
          const modId = endorsement.mod_id;
          if (prev[gameId] === undefined) {
            prev[gameId] = {};
          }
          prev[gameId][modId] = endorsement.status;
          return prev;
        }, {});
      const state: IState = store.getState();
      Object.keys(state.session.extensions.installed).forEach(extId => {
        const modId = state.session.extensions.installed[extId].modId;

        if (modId !== undefined) {
          const endorsed = getSafe(endorseMap, [SITE_ID, modId], 'Undecided');
          store.dispatch(setExtensionEndorsed(extId, endorsed));
        }
      });
      const allMods = state.persistent.mods;
      Object.keys(allMods).forEach(gameId => {
        Object.keys(allMods[gameId]).forEach(modId => {
          const dlGame = getSafe(allMods, [gameId, modId, 'attributes', 'downloadGame'], gameId);
          const nexModId = getSafe(allMods, [gameId, modId, 'attributes', 'modId'], undefined);
          const oldEndorsed =
            getSafe(allMods, [gameId, modId, 'attributes', 'endorsed'], 'Undecided');
          const endorsed = getSafe(endorseMap, [dlGame, nexModId], 'Undecided');
          if (endorsed !== oldEndorsed) {
            store.dispatch(setModAttribute(gameId, modId, 'endorsed', endorsed));
          }
        });
      });
    });
}

function filterByUpdateList(store: Redux.Store<any>,
                            nexus: Nexus,
                            gameId: string,
                            input: IMod[]): Promise<IMod[]> {
  const getGameId = (mod: IMod) => getSafe(mod.attributes, ['downloadGame'], undefined) || gameId;

  // all game ids for which we have mods installed
  const gameIds = Array.from(new Set(input.map(getGameId)));

  interface IMinAgeMap { [gameId: string]: number; }
  interface IUpdateMap { [gameId: string]: IUpdateEntry[]; }

  // for each game, stores the update time of the least recently updated mod
  const minAge: IMinAgeMap = input.reduce((prev: IMinAgeMap, mod: IMod) => {
    const modGameId = getGameId(mod);
    const lastUpdate = getSafe(mod.attributes, ['lastUpdateTime'], undefined);
    if ((lastUpdate !== undefined)
        && ((prev[modGameId] === undefined) || (prev[modGameId] > lastUpdate))) {
      prev[modGameId] = lastUpdate;
    }
    return prev;
  }, {});

  return Promise.reduce(gameIds, (prev: IUpdateMap, iterGameId: string) =>
    // minAge map may be missing certain gameIds when none of the installed mods
    //  for that gameId have the lastUpdateTime attribute. We still want to check for
    //  updates in this scenario - the lastUpdateTime attribute will be populated immediately
    //  after the update.
    fetchRecentUpdates(store, nexus, iterGameId, minAge[iterGameId] || 0)
      .then(entries => {
        prev[iterGameId] = entries;
        return prev;
      }), {})
      .then((updateLists: IUpdateMap) => {
        const updateMap: { [gameId: string]: { [modId: string]: number } } = {};

        Object.keys(updateLists).forEach(iterGameId => {
          updateMap[iterGameId] = updateLists[iterGameId].reduce((prev, entry) => {
            prev[entry.mod_id] = Math.max((entry as any).latest_file_update,
                                          (entry as any).latest_mod_activity) * 1000;
            return prev;
          }, {});
        });

        const now = Date.now();

        return input.filter(mod => {
          const modGameId = getGameId(mod);
          if (updateMap[modGameId] === undefined) {
            // the game hasn't been checked for updates for so long we can't fetch an update range
            // long enough
            return true;
          }
          const lastUpdate = getSafe(mod.attributes, ['lastUpdateTime'], 0);
          // check anything for updates that is either in the update list and has been updated as
          // well as anything that has last been checked before the range of the update list
          return (lastUpdate < getSafe(updateMap, [modGameId, mod.attributes.modId], 1))
              || ((now - lastUpdate) > 28 * ONE_DAY);
        });
      });
}

export function checkModVersionsImpl(
  store: Redux.Store<any>,
  nexus: Nexus,
  gameId: string,
  mods: { [modId: string]: IMod },
  forceFull: boolean | 'silent'): Promise<{ errors: string[], modIds: string[] }> {

  const now = Date.now();

  const modsList: IMod[] = Object.keys(mods)
    .map(modId => mods[modId])
    .filter(mod => getSafe(mod.attributes, ['source'], undefined) === 'nexus')
    .filter(mod =>
      (now - (getSafe(mod.attributes, ['lastUpdateTime'], 0) || 0)) > UPDATE_CHECK_DELAY)
    ;

  log('info', '[update check] checking mods for update (nexus)', { count: modsList.length });

  const updatedIds: string[] = [];

  return refreshEndorsements(store, nexus)
    .then(() => filterByUpdateList(store, nexus, gameId, modsList))
    .then((filteredMods: IMod[]) => {
      const filtered = new Set(filteredMods.map(mod => mod.id));
      const tStore = (store as ThunkStore<any>);
      let pos = 0;
      const progress = () => {
        tStore.dispatch(addNotification({
          id: 'check-update-progress',
          type: 'activity',
          message: 'Checking mods for update',
          progress: (pos * 100) / filteredMods.length,
        }));
        ++pos;
      };
      progress();
      if (forceFull) {
        log('info', '[update check] forcing full update check (nexus)',
          { count: modsList.length });
      } else {
        log('info', '[update check] optimized update check (nexus)',
          { count: filteredMods.length, of: modsList.length });
      }

      const updatesMissed: IMod[] = [];

      const verP = ['attributes', 'version'];
      const fileIdP = ['attributes', 'fileId'];
      const newWerP = ['attributes', 'newestVersion'];
      const newFileIdP = ['attributes', 'newestFileId'];

      return Promise.map(modsList, (mod: IMod) => {
        if (!forceFull && !filtered.has(mod.id)) {
          store.dispatch(setModAttribute(gameId, mod.id, 'lastUpdateTime', now - 15 * ONE_MINUTE));
          return;
        }

        return checkModVersion(store, nexus, gameId, mod)
          .then(() => {
            const modNew = getSafe(store.getState(),
                                   ['persistent', 'mods', gameId, mod.id], undefined);

            const newestVerChanged =
              getSafe(modNew, newWerP, undefined) !== getSafe(mod, newWerP, undefined);
            const verChanged =
              getSafe(modNew, newWerP, undefined) !== getSafe(modNew, verP, undefined);
            const newestFileIdChanged =
              getSafe(modNew, newFileIdP, undefined) !== getSafe(mod, newFileIdP, undefined);
            const fileIdChanged =
              getSafe(modNew, newFileIdP, undefined) !== getSafe(modNew, fileIdP, undefined);

            const updateFound = (newestVerChanged && verChanged)
                             || (newestFileIdChanged && fileIdChanged);

            if (updateFound) {
              updatedIds.push(mod.id);
              if (truthy(forceFull) && !filtered.has(mod.id)) {
                log('warn', '[update check] Mod update would have been missed with regular check', {
                  modId: mod.id,
                  lastUpdateTime: getSafe(mod, ['attributes', 'lastUpdateTime'], 0),
                  'before.newestVersion': getSafe(mod, newWerP, ''),
                  'before.newestFileId': getSafe(mod, newFileIdP, ''),
                  'after.newestVersion': getSafe(modNew, newWerP, ''),
                  'after.newestFileId': getSafe(modNew, newFileIdP, ''),
                });
                updatesMissed.push(mod);
              } else {
                log('info', '[update check] Mod update detected', {
                  modId: mod.id,
                  lastUpdateTime: getSafe(mod, ['attributes', 'lastUpdateTime'], 0),
                  'before.newestVersion': getSafe(mod, newWerP, ''),
                  'before.newestFileId': getSafe(mod, newFileIdP, ''),
                  'after.newestVersion': getSafe(modNew, newWerP, ''),
                  'after.newestFileId': getSafe(modNew, newFileIdP, ''),
                });
              }

              store.dispatch(setModAttribute(gameId, mod.id, 'lastUpdateTime', now));
            }
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
              return Promise.resolve(undefined);
            }

            const name = modName(mod, { version: true });
            const nameLink = `[url=${nexusLink(store.getState(), mod, gameId)}]${name}[/url]`;

            return (detail.Servermessage !== undefined)
              ? `${nameLink}:<br/>${detail.message}<br/>Server said: "${detail.Servermessage}"<br/>`
              : `${nameLink}:<br/>${detail.message}`;
          })
          .finally(() => {
            progress();
          });

      }, { concurrency: 4 })
      .finally(() => {
        log('info', '[update check] done');
        tStore.dispatch(dismissNotification('check-update-progress'));
        // if forceFull is 'silent' we show no notifications
        if (forceFull === true) {
          if (updatesMissed.length === 0) {
            tStore.dispatch(addNotification({
              id: 'check-update-progress',
              type: 'info',
              message: 'Full update check found no updates that the regular check didn\'t.',
            }));
          } else {
            tStore.dispatch(addNotification({
              id: 'check-update-progress',
              type: 'info',
              message:
                'Full update found {{count}} updates that the regular check would have missed. '
                + 'Please send in a feedback with your log attached to help debug the cause.',
              replace: {
                count: updatesMissed.length,
              },
            }));
          }
        }
      });
    })
    .then((errorMessages: string[]): { errors: string[], modIds: string[] } => ({
      errors: errorMessages.filter(msg => msg !== undefined),
      modIds: updatedIds,
    }));
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
      return github.fetchConfig('api')
        .then(configObj => {
          const currentVer = app.getVersion();
          if ((currentVer !== '0.0.1')
            && (semver.lt(currentVer, configObj.minversion))) {
            (nexus as any).disable();
            api.sendNotification({
              type: 'warning',
              title: 'Vortex outdated',
              message: 'Your version of Vortex is quite outdated. Network features disabled.',
              actions: [
                {
                  title: 'Check for update', action: () => {
                    ipcRenderer.send('check-for-updates', 'stable');
                  },
                },
              ],
            });
          }
        })
        .catch(err => {
          log('warn', 'Failed to fetch api config', { message: err.message });
        });
    })
    // don't stop the login just because the github rate limit is exceeded
    .catch(RateLimitExceeded, () => Promise.resolve())
    .catch(TimeoutError, () => {
      api.sendNotification({
        type: 'error',
        message: 'API Key validation timed out',
        actions: [
          { title: 'Retry', action: dismiss => { updateKey(api, nexus, key); dismiss(); } },
        ],
      });
      api.store.dispatch(setUserInfo(undefined));
    })
    .catch(NexusError, err => {
      api.sendNotification({
        id: 'nexus-login-failed',
        type: 'error',
        title: 'Failed to log in',
        message: errorFromNexusError(err),
        actions: [
          { title: 'Try again', action: dismiss => {
            updateKey(api, nexus, key);
          } },
        ],
      });
      api.store.dispatch(setUserInfo(undefined));
    })
    .catch(ProcessCanceled, err => {
      log('debug', 'login canceled', err.message);
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

let onCacheLoaded: () => void;
const cachePromise = new Promise(resolve => onCacheLoaded = resolve);

export function retrieveNexusGames(nexus: Nexus) {
  nexus.getGames()
    .then(games => {
      nexusGamesCache = games.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
      onCacheLoaded();
    })
    .catch(err => null);
}

export function nexusGames(): IGameListEntry[] {
  return nexusGamesCache;
}

export function nexusGamesProm(): Promise<IGameListEntry[]> {
  return cachePromise.then(() => nexusGamesCache);
}
