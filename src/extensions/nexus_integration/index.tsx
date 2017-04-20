import { IDialogResult, showDialog } from '../../actions/notifications';
import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import LazyComponent from '../../util/LazyComponent';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import { currentGame, getSafe } from '../../util/storeHelper';
import InputButton from '../../views/InputButton';

import EndorsementFilter from './views/EndorsementFilter';

import { ICategoryDictionary } from '../category_management/types/IcategoryDictionary';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { setModAttribute } from '../mod_management/actions/mods';
import { setUpdatingMods } from '../mod_management/actions/settings';
import { IMod } from '../mod_management/types/IMod';
import modName from '../mod_management/util/modName';
import { IProfileMod } from '../profile_management/types/IProfile';

import NXMUrl from './NXMUrl';
import { accountReducer } from './reducers/account';
import { settingsReducer } from './reducers/settings';
import { checkModsVersion } from './util/checkModsVersion';
import { convertGameId, toNXMId } from './util/convertGameId';
import sendEndorseMod from './util/endorseMod';
import retrieveCategoryList from './util/retrieveCategories';
import EndorseModButton from './views/EndorseModButton';
import LoginIcon from './views/LoginIcon';
import NexusModIdDetail from './views/NexusModIdDetail';
import {} from './views/Settings';

import * as Promise from 'bluebird';
import Nexus, { IDownloadURL, IFileInfo } from 'nexus-api';
import * as opn from 'opn';
import * as React from 'react';
import * as util from 'util';

type IModWithState = IMod & IProfileMod;

let nexus: Nexus;
let endorseMod: (gameId: string, modId: string, endorsedState: string) => void;

export interface IExtensionContextExt extends IExtensionContext {
  registerDownloadProtocol: (schema: string,
    handler: (inputUrl: string) => Promise<string[]>) => void;
}

function startDownload(api: IExtensionApi, nxmurl: string, automaticInstall: boolean) {
  const url: NXMUrl = new NXMUrl(nxmurl);

  let nexusFileInfo: IFileInfo;

  let gameId = convertGameId(url.gameId);

  nexus.getFileInfo(url.modId, url.fileId, gameId)
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
      let uris: string[] = urls.map((item: IDownloadURL) => item.URI);
      log('debug', 'got download urls', { uris });
      api.events.emit('start-download', uris, {
        game: url.gameId.toLowerCase(),
        nexus: {
          ids: { gameId, modId: url.modId, fileId: url.fileId },
          fileInfo: nexusFileInfo,
        },
      }, automaticInstall);
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
      }, {
          Cancel: null,
          Retrieve: null,
        }))
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
        let message = processErrorMessage(err.statusCode, err, gameId);
        showError(api.store.dispatch,
          'An error occurred retrieving the Game Info', message);
      });
  });
};

interface IRequestError {
  error: string;
  servermessage?: string;
  game?: string;
  fatal?: boolean;
}

function processErrorMessage(
  statusCode: number, errorMessage: string, gameId: string): IRequestError {
  if (statusCode === undefined) {
    return { error: errorMessage };
  } else if ((statusCode >= 400) && (statusCode < 500)) {
    return {
      error: 'Server couldn\'t process this request.\nMaybe the locally stored '
      + 'info about the mod is wrong\nor the mod was removed from Nexus.',
      servermessage: errorMessage,
      fatal: errorMessage === undefined,
    };
 } else if ((statusCode >= 500) && (statusCode < 600)) {
    return {
      error: 'The server reported an internal error. Please try again later.',
      servermessage: errorMessage,
    };
  } else {
    return {
      error: 'Unexpected error reported by the server',
      servermessage: (errorMessage || '') + ' ( Status Code: ' + statusCode + ')',
    };
  }
}

function endorseModImpl(
  store: Redux.Store<any>,
  gameId: string,
  modId: string, endorsedStatus: string) {
  const mod: IMod = getSafe(store.getState(), ['persistent', 'mods', gameId, modId], undefined);

  if (mod === undefined) {
    log('warn', 'tried to endorse unknown mod', { gameId, modId });
    return;
  }

  const nexusModId: number = parseInt(getSafe(mod.attributes, ['modId'], '0'), 10);
  const version: string = getSafe(mod.attributes, ['version'], undefined);

  store.dispatch(setModAttribute(gameId, modId, 'endorsed', 'pending'));
  sendEndorseMod(nexus, convertGameId(gameId), nexusModId, version, endorsedStatus)
    .then((endorsed: string) => {
      store.dispatch(setModAttribute(gameId, modId, 'endorsed', endorsed));
    })
    .catch((err) => {
      store.dispatch(setModAttribute(gameId, modId, 'endorsed', 'Undecided'));
      const detail = processErrorMessage(err.statusCode, err.message, gameId);
      showError(store.dispatch, 'An error occurred endorsing a mod', detail);
    });
};

function checkModsVersionImpl(
  store: Redux.Store<any>,
  gameId: string,
  groupedMods: { [id: string]: IModWithState[] },
  mods: { [modId: string]: IMod }): Promise<string[]> {

  const modsList = Object.keys(mods).map(modId => mods[modId]);

  return Promise.map(modsList, (mod: IMod) => {
    return checkModsVersion(store.dispatch, nexus, gameId, mod)
      .catch((err) => {
        let detail = processErrorMessage(err.statusCode, err.message, gameId);
        if (detail.fatal) {
          return Promise.reject(detail);
        }

        let name = modName(mod, { version: true });
        if (detail.servermessage !== undefined) {
          return `${name}:\n${detail.error}\nServer said: "${detail.servermessage}"`;
        } else {
          return `${name}:\n${detail.error}`;
        }
      });
  })
  .then(errorMessages => errorMessages.filter(msg => msg !== undefined));
}

function renderNexusModIdDetail(
  store: Redux.Store<any>,
  mod: IMod,
  t: I18next.TranslationFunction) {
  const nexusModId: string = getSafe(mod.attributes, ['modId'], undefined);
  const gameMode = activeGameId(store.getState());
  return (
    <NexusModIdDetail
      modId={mod.id}
      nexusModId={nexusModId}
      gameId={gameMode}
      t={t}
      store={store}
    />
  );
}

function createEndorsedIcon(store: Redux.Store<any>, mod: IMod, t: I18next.TranslationFunction) {
  const nexusModId: string = getSafe(mod.attributes, ['modId'], undefined);
  const version: string = getSafe(mod.attributes, ['version'], undefined);

  // TODO this is not a reliable way to determine if the mod is from nexus
  const isNexusMod: boolean = (nexusModId !== undefined)
      && (version !== undefined)
      && !isNaN(parseInt(nexusModId, 10));

  const endorsed: string = getSafe(mod.attributes, ['endorsed'],
                                   isNexusMod ? 'Undecided' : undefined);
  const gameMode = activeGameId(store.getState());
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

function init(context: IExtensionContextExt): boolean {
  context.registerFooter('login', LoginIcon, () => ({ nexus }));
  context.registerSettings('Download', LazyComponent('./views/Settings', __dirname));
  context.registerReducer(['confidential', 'account', 'nexus'], accountReducer);
  context.registerReducer(['settings', 'nexus'], settingsReducer);

  context.registerDownloadProtocol('nxm:', (nxmurl: string): Promise<string[]> => {
    const nxm: NXMUrl = new NXMUrl(nxmurl);
    return nexus.getDownloadURLs(nxm.modId, nxm.fileId, convertGameId(nxm.gameId))
      .map((url: IDownloadURL): string => {
        return url.URI;
      });
  });

  context.registerIcon('download-icons', 100, InputButton,
    () => ({
      key: 'input-nxm-url',
      id: 'input-nxm-url',
      groupId: 'download-buttons',
      icon: 'nexus',
      tooltip: 'Download NXM URL',
      onConfirmed: (nxmurl: string) => startDownload(context.api, nxmurl, false),
    }));

  context.registerIcon('categories-icons', 100, 'download', 'Retrieve categories',
    () => retrieveCategories(context.api, true));

  context.registerTableAttribute('mods', {
    id: 'endorsed',
    name: 'Endorsed',
    description: 'Endorsement state on Nexus',
    icon: 'star',
    customRenderer: (mod: IMod, detail: boolean, t: I18next.TranslationFunction) =>
      createEndorsedIcon(context.api.store, mod, t),
    calc: (mod: IMod) => getSafe(mod.attributes, ['endorsed'], undefined),
    placement: 'table',
    isToggleable: true,
    edit: {},
    isSortable: true,
    filter: new EndorsementFilter(),
  });

  context.registerTableAttribute('mods', {
    id: 'nexusModId',
    name: 'Nexus Mod ID',
    description: 'Internal ID used by www.nexusmods.com',
    icon: 'external-link',
    customRenderer: (mod: IMod, detail: boolean, t: I18next.TranslationFunction) =>
      renderNexusModIdDetail(context.api.store, mod, t),
    calc: (mod: IMod) => getSafe(mod.attributes, ['modId'], undefined),
    placement: 'detail',
    isToggleable: false,
    edit: {},
    isSortable: false,
  });

  context.once(() => {
    let state = context.api.store.getState();

    nexus = new Nexus(activeGameId(state),
      getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], '')
    );

    const gameMode = activeGameId(context.api.store.getState());
    context.api.store.dispatch(setUpdatingMods(gameMode, false));

    endorseMod = (gameId: string, modId: string, endorsedStatus: string) =>
      endorseModImpl(context.api.store, gameId, modId, endorsedStatus);

    let registerFunc = () => {
      context.api.registerProtocol('nxm', (url: string) => {
        startDownload(context.api, url, false);
      });
    };
    if (context.api.store.getState().settings.nexus.associateNXM) {
      registerFunc();
    }

    context.api.events.on('retrieve-category-list', (isUpdate: boolean) => {
      retrieveCategories(context.api, isUpdate);
    });

    context.api.events.on('check-mods-version', (gameId, groupedMods, mods) => {
      context.api.store.dispatch(setUpdatingMods(gameId, true));
      checkModsVersionImpl(context.api.store, gameId, groupedMods, mods)
        .then((errorMessages: string[]) => {
          if (errorMessages.length !== 0) {
            showError(context.api.store.dispatch,
              'checking for updates succeeded but there were errors',
              errorMessages.join('\n\n'));
          }
        })
        .catch((err) => {
          showError(context.api.store.dispatch,
            'checking for updates failed',
            err.message);
        })
        .finally(() => {
          context.api.store.dispatch(setUpdatingMods(gameId, false));
        });
    });

    context.api.events.on('endorse-mod', (gameId, modId, endorsedStatus) => {
      endorseModImpl(context.api.store, gameId, modId, endorsedStatus);
    });

    context.api.onStateChange(['settings', 'nexus', 'associateNXM'],
      (oldValue: boolean, newValue: boolean) => {
        log('info', 'associate', { oldValue, newValue });
        if (newValue === true) {
          registerFunc();
        } else {
          context.api.deregisterProtocol('nxm');
        }
      }
    );

    context.api.events.on('gamemode-activated', (gameId: string) => {
      nexus.setGame(gameId);
    });

    context.api.onStateChange(['confidential', 'account', 'nexus', 'APIKey'],
      (oldValue: string, newValue: string) => {
        nexus.setKey(newValue);
      });

    context.api.events.on('download-mod-update', (gameId, modId, fileId) => {
      // TODO: Need some way to identify if this request is actually for a nexus mod
      const url = `nxm://${toNXMId(gameId)}/mods/${modId}/files/${fileId}`;
      startDownload(context.api, url, true);
    });

    context.api.events.on('open-mod-page', (gameId, modId) => {
      opn(['http://www.nexusmods.com',
        convertGameId(gameId), 'mods', modId,
      ].join('/'));
    });
  });

  return true;
}

export default init;
