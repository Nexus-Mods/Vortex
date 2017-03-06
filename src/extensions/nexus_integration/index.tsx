
import { IDialogResult, showDialog } from '../../actions/notifications';
import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import { currentGame, getSafe } from '../../util/storeHelper';
import InputButton from '../../views/InputButton';
import { IconButton } from '../../views/TooltipControls';

import { ICategoryDictionary } from '../category_management/types/IcategoryDictionary';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { setModAttribute } from '../mod_management/actions/mods';
import { IMod } from '../mod_management/types/IMod';

import NXMUrl from './NXMUrl';
import { accountReducer } from './reducers/account';
import { settingsReducer } from './reducers/settings';
import retrieveEndorsedMod from './util/endorseMod';
import retrieveCategoryList from './util/retrieveCategories';
import EndorseModButton from './views/EndorseModButton';
import LoginIcon from './views/LoginIcon';
import Settings from './views/Settings';

import * as Promise from 'bluebird';
import Nexus, { IDownloadURL, IFileInfo } from 'nexus-api';
import * as React from 'react';
import * as util from 'util';

let nexus: Nexus;

export interface IExtensionContextExt extends IExtensionContext {
  registerDownloadProtocol: (schema: string,
    handler: (inputUrl: string) => Promise<string[]>) => void;
}

/**
 * convert the game id from either our internal format or the format
 * used in NXM links to the format used in the nexus api.
 * TODO: This works only as one function because our internal id so
 *   far coincides with the nxm link format except for upper/lower case.
 *   This should be two functions!
 */
function convertGameId(input: string): string {
  let inputL = input.toLowerCase();
  if (inputL === 'skyrimse') {
    return 'skyrimspecialedition';
  } else if (inputL === 'falloutnv') {
    return 'newvegas';
  } else {
    return input;
  }
}

function startDownload(api: IExtensionApi, nxmurl: string) {
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
      });
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
        api.events.emit('retrieve-categories', [gameId, categories, isUpdate], {});
      })
      .catch((err) => {
        let message = processErrorMessage(err.statusCode, err, gameId, api.translate);
        showError(api.store.dispatch,
          'An error occurred retrieving the Game Info', message);
      });
  });
};

function processErrorMessage(
  statusCode: number, errorMessage: string, gameId: string,
  t: I18next.TranslationFunction) {
  let message = '';
  if (statusCode === 404) {
    return message = t('Game not found: {{gameId}}', { replace: { gameId } });
  } else if ((statusCode >= 500) && (statusCode < 600)) {
    return message = t('Internal server error');
  } else {
    return message = t('Unknown error, server reported: {{errorMessage}}',
      { replace: { errorMessage } });
  }
}

function endorseMod(api: IExtensionApi, modId: string, 
                    id: string, version: string, endorsedStatus: string) {
  let gameId;
  currentGame(api.store)
    .then((game: IGameStored) => {
      gameId = game.id;
      log('info', 'endorse mod ', modId);
      return retrieveEndorsedMod(nexus, gameId, modId, version, endorsedStatus);
    })
    .then((endorsed: string) => {
      api.store.dispatch(setModAttribute(gameId, id, 'endorsed', endorsed));
    })
    .catch((err) => {
      let message = processErrorMessage(err.statusCode, err.message, gameId, api.translate);
      showError(api.store.dispatch,
        'An error occurred endorsing a mod', message);
    });
};

function getEndorsedIcon(api: IExtensionApi, mod: IMod) {
  let endorsed: string = getSafe(mod.attributes, ['endorsed'], '');
  let modId: string = getSafe(mod.attributes, ['modId'], '');
  let version: string = getSafe(mod.attributes, ['version'], '');

  if (endorsed === undefined) {
    const gameMode = activeGameId(api.store.getState());
    if (modId !== undefined) {
      nexus.getModInfo(parseInt(modId, null), gameMode)
        .then((modInfo: any) => {
          api.store.dispatch(setModAttribute(gameMode, mod.id,
            'endorsed', modInfo.endorsement.endorse_status));
          if (version === '') {
            version = modInfo.version;
            api.store.dispatch(setModAttribute(gameMode, mod.id,
            'version', modInfo.version));
          }
        })
        .catch((err) => {
          showError(api.store.dispatch, 'An error occurred endorsing the mod', err.message);
        });
    }
  }

  return (
    <EndorseModButton
      api={api}
      endorsedStatus={endorsed}
      t={api.translate}
      id={mod.id}
      modId={modId}
      version={version}
      onEndorseMod={endorseEmitter}
    />
  );

}

function endorseEmitter(api: IExtensionApi, modId: string,
                        id: string, version: string, endorsedStatus: string) {
  api.events.emit('endorse-mod', [modId, id, version, endorsedStatus]);
}

function init(context: IExtensionContextExt): boolean {
  context.registerFooter('login', LoginIcon, () => ({ nexus }));
  context.registerSettings('Download', Settings);
  context.registerReducer(['confidential', 'account', 'nexus'], accountReducer);
  context.registerReducer(['settings', 'nexus'], settingsReducer);

  context.registerDownloadProtocol('nxm:', (nxmurl: string): Promise<string[]> => {
    const nxm: NXMUrl = new NXMUrl(nxmurl);
    return nexus.getDownloadURLs(nxm.modId, nxm.fileId, convertGameId(nxm.gameId))
      .map((url: IDownloadURL): string => {
        return url.URI;
      });
  });

  context.registerIcon('download-icons', InputButton,
    () => ({
      key: 'input-nxm-url',
      id: 'input-nxm-url',
      groupId: 'download-buttons',
      icon: 'nexus',
      tooltip: 'Download NXM URL',
      onConfirmed: (nxmurl: string) => startDownload(context.api, nxmurl),
    }));

  context.registerIcon('categories-icons', IconButton,
    () => ({
      key: 'retrieve-categories',
      id: 'retrieve-categories',
      icon: 'download',
      tooltip: 'Retrieve categories',
      onClick: () => retrieveCategories(context.api, true),
    }));

  // context.registerIcon('mod-icons', )

  context.registerTableAttribute('mods', {
    id: 'endorsed',
    name: 'Endorsed',
    description: 'Endorsed',
    icon: 'star',
    customRenderer: (mod: IMod) => getEndorsedIcon(context.api, mod),
    calc: (mod: IMod) => getSafe(mod.attributes, ['endorsed'], ''),
    placement: 'table',
    isToggleable: true,
    edit: {},
    isSortable: true,
  });

  context.once(() => {
    let state = context.api.store.getState();
    nexus = new Nexus(activeGameId(state),
      getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], '')
    );
    let registerFunc = () => {
      context.api.registerProtocol('nxm', (url: string) => {
        startDownload(context.api, url);
      });
    };
    if (context.api.store.getState().settings.nexus.associateNXM) {
      registerFunc();
    }

    context.api.events.on('retrieve-category-list', (isUpdate: boolean) => {
      retrieveCategories(context.api, isUpdate);
    });

    context.api.events.on('endorse-mod', (result: any) => {
      let modId = result[0];
      let id = result[1];
      let version = result[2];
      let endorsedStatus = result[3];
      endorseMod(context.api, modId, id, version, endorsedStatus);
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

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      nexus.setGame(gameMode);
    });

    context.api.onStateChange(['confidential', 'account', 'nexus', 'APIKey'],
      (oldValue: string, newValue: string) => {
        nexus.setKey(newValue);
      });
  });

  return true;
}

export default init;
