
import { IDialogResult, showDialog } from '../../actions/notifications';
import { IExtensionApi, IExtensionContext } from '../../types/IExtensionContext';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { currentGame, getSafe } from '../../util/storeHelper';
import Icon from '../../views/Icon';
import InputButton from '../../views/InputButton';
import { Button, IconButton } from '../../views/TooltipControls';

import { ICategoryDictionary } from '../category_management/types/IcategoryDictionary';
import { IGameStored } from '../gamemode_management/types/IStateEx';
import { IMod } from '../mod_management/types/IMod';

import NXMUrl from './NXMUrl';
import { accountReducer } from './reducers/account';
import { settingsReducer } from './reducers/settings';
import retrieveEndorsedMod from './util/endorseMod';
import retrieveCategoryList from './util/retrieveCategories';
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

function convertGameId(input: string): string {
  if (input === 'skyrimse') {
    return 'skyrimspecialedition';
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

function processErrorMessage(statusCode: number, errorMessage: string, gameId: string,
                             t: I18next.TranslationFunction) {
  let message = '';
  if (statusCode === 404) {
    return message = t('Game not found: {{gameId}}', { replace: { gameId } });
  } else if ((statusCode >= 500) && (statusCode < 600)) {
    return message = t('Internal server error');
  } else {
    return message = t('Unknown error, server reported {{errorMessage}}',
      { replace: { errorMessage } });
  }
}

function endorseMod(result) {
  let api = result[0];
  let isEndorsed = result[1];
  let modId = result[2];
  let gameId;
  currentGame(api.store)
    .then((game: IGameStored) => {
      gameId = game.id;
      log('info', 'endorse mod ', modId);
      return retrieveEndorsedMod(gameId, nexus, isEndorsed, modId);
    })
    .then((endorsed: boolean) => {
      api.events.emit('endorse-mod-result', [modId, endorsed], {});
    })
    .catch((err) => {
      let message = processErrorMessage(err.statusCode, err.errorMessage, gameId, api.translate);
      showError(api.store.dispatch,
        'An error occurred endorsing a mod', message);
    });
};

function getEndorsedIcon(api: IExtensionApi, mod: IMod) {
  let isEndorsed = getSafe(mod.attributes, ['endorsed'], '');
  return (
    <div style={{ textAlign: 'center' }}>
      <Button
        id={mod.id}
        tooltip='Endorse'
        onClick={endorseMod.bind(this, [api, isEndorsed, mod.id])}
      >
        <Icon name={isEndorsed ? 'star' : 'star-o'} />
      </Button>
    </div>
  );
}

function init(context: IExtensionContextExt): boolean {
  context.registerFooter('login', LoginIcon, () => ({ nexus }));
  context.registerSettings('Download', Settings);
  context.registerReducer(['account', 'nexus'], accountReducer);
  context.registerReducer(['settings', 'nexus'], settingsReducer);

  if (context.registerDownloadProtocol !== undefined) {
    context.registerDownloadProtocol('nxm:', (nxmurl: string): Promise<string[]> => {
      const nxm: NXMUrl = new NXMUrl(nxmurl);
      return nexus.getDownloadURLs(nxm.modId, nxm.fileId, convertGameId(nxm.gameId))
        .map((url: IDownloadURL): string => {
          return url.URI;
        });
    });
  }

  context.registerIcon('download-icons', InputButton,
    () => ({
      key: 'input-nxm-url',
      id: 'input-nxm-url',
      groupId: 'download-buttons',
      icon: 'nexus',
      tooltip: 'Download NXM URL',
      onConfirmed: (nxmurl: string) => startDownload(context.api, nxmurl),
    }));

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

  context.registerIcon('categories-icons', IconButton,
    () => ({
      key: 'retrieve-categories',
      id: 'retrieve-categories',
      icon: 'download',
      tooltip: 'Retrieve categories',
      onClick: () => retrieveCategories(context.api, true),
    }));

  context.once(() => {
    let state = context.api.store.getState();
    nexus = new Nexus(
      getSafe(state, ['settings', 'gameMode', 'current'], ''),
      getSafe(state, ['account', 'nexus', 'APIKey'], '')
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

    context.api.onStateChange(['settings', 'gameMode', 'current'],
      (oldValue: string, newValue: string) => {
        nexus.setGame(newValue);
      });

    context.api.onStateChange(['account', 'nexus', 'APIKey'],
      (oldValue: string, newValue: string) => {
        nexus.setKey(newValue);
      });
  });

  return true;
}

export default init;
