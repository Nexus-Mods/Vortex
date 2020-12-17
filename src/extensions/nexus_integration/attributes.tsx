import { setModAttribute } from '../../actions';
import { IconButton } from '../../controls/TooltipControls';
import { IExtensionApi, IMod, ITableAttribute } from '../../types/api';
import { laterT } from '../../util/i18n';
import { activeGameId, currentGame, gameById, knownGames } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { IModWithState } from '../mod_management/types/IModProps';
import { nexusGames } from './util';
import { convertGameIdReverse, nexusGameId } from './util/convertGameId';
import EndorsementFilter from './views/EndorsementFilter';
import EndorseModButton from './views/EndorseModButton';
import NexusModIdDetail from './views/NexusModIdDetail';

import Nexus from '@nexusmods/nexus-api';
import { TFunction } from 'i18next';
import * as React from 'react';
import * as Redux from 'redux';

// TODO: the field names in this object will be shown to the user, hence the capitalization
function renderNexusModIdDetail(
  store: Redux.Store<any>,
  mod: IModWithState,
  t: TFunction) {
  const nexusModId: string = getSafe(mod.attributes, ['modId'], undefined);
  const fileName: string =
    getSafe(mod.attributes, ['fileName'],
      getSafe(mod.attributes, ['name'], undefined));
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

export type EndorseMod = (gameId: string, modId: string, endorsedStatus: string) => void;
export type TrackMod = (gameId: string, modId: string, track: boolean) => void;

function createEndorsedIcon(store: Redux.Store<any>,
                            mod: IMod,
                            onEndorse: EndorseMod,
                            t: TFunction) {
  const nexusModId: string = getSafe(mod.attributes, ['modId'], undefined);
  const version: string = getSafe(mod.attributes, ['version'], undefined);
  const state: string = getSafe(mod, ['state'], undefined);

  // TODO: this is not a reliable way to determine if the mod is from nexus
  const isNexusMod: boolean = (nexusModId !== undefined)
    && (version !== undefined)
    && !isNaN(parseInt(nexusModId, 10));

  let endorsed: string = getSafe(mod.attributes, ['endorsed'], undefined);
  if ((endorsed === undefined) && (state === 'downloaded')) {
    // The mod is sourced from nexus but is not installed, which means
    //  we can't endorse the mod anyway and therefore should just hide the endorse button.
    return null;
  }

  const allowRating: boolean = getSafe(mod.attributes, ['allowRating'], true);
  if (!allowRating) {
    endorsed = 'Disabled';
  }

  if ((endorsed === undefined && state === 'installing')
   || (endorsed === undefined && isNexusMod)) {
    endorsed = 'Undecided';
  }

  if (getSafe(mod.attributes, ['author'], undefined)
      === getSafe(store.getState(), ['persistent', 'nexus', 'userInfo', 'name'], undefined)) {
    endorsed = undefined;
  }

  const gameId = getSafe(mod.attributes, ['downloadGame'], undefined)
               || activeGameId(store.getState());
  if (endorsed !== undefined) {
    return (
      <EndorseModButton
        endorsedStatus={endorsed}
        t={t}
        gameId={gameId}
        modId={mod.id}
        onEndorseMod={onEndorse}
      />
    );
  }

  return null;
}

export function genEndorsedAttribute(api: IExtensionApi,
                                     onEndorseMod: EndorseMod): ITableAttribute {
  return {
    id: 'endorsed',
    name: laterT('Endorsed'),
    description: laterT('Endorsement state on Nexus'),
    icon: 'star',
    customRenderer: (mod: IMod, detail: boolean, t: TFunction) =>
      getSafe(mod.attributes, ['source'], undefined) === 'nexus'
        ? createEndorsedIcon(api.store, mod, onEndorseMod, t)
        : null,
    calc: (mod: IMod) =>
      getSafe(mod.attributes, ['source'], undefined) === 'nexus'
        ? getSafe(mod.attributes, ['endorsed'], null)
        : undefined,
    placement: 'table',
    isToggleable: true,
    edit: {},
    isSortable: true,
    filter: new EndorsementFilter(),
  };
}

export function genModIdAttribute(api: IExtensionApi): ITableAttribute {
  return {
    id: 'nexusModId',
    name: laterT('Nexus Mod ID'),
    description: laterT('Internal ID used by www.nexusmods.com'),
    icon: 'external-link',
    customRenderer: (mod: IModWithState, detail: boolean, t: TFunction) => {
      const res = getSafe(mod.attributes, ['source'], undefined) === 'nexus'
        ? renderNexusModIdDetail(api.store, mod, t)
        : null;
      return res;
    },
    calc: (mod: IMod) =>
      getSafe(mod.attributes, ['source'], undefined) === 'nexus'
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

export function genGameAttribute(api: IExtensionApi): ITableAttribute<IMod> {
  return {
    id: 'downloadGame',
    name: laterT('Game Section'),
    description: laterT('NexusMods Game Section'),
    calc: mod => {
      if (getSafe(mod.attributes, ['source'], undefined) !== 'nexus') {
        return undefined;
      }
      let downloadGame: string | string[] = getSafe(mod.attributes, ['downloadGame'], undefined);
      if (Array.isArray(downloadGame)) {
        downloadGame = downloadGame[0];
      }
      const game = downloadGame !== undefined
        ? gameById(api.store.getState(), downloadGame)
        : currentGame(api.store.getState());
      const nexusId = nexusGameId(game) || downloadGame;
      const gameEntry = nexusGames().find(iter => iter.domain_name === nexusId);
      return (gameEntry !== undefined)
        ? gameEntry.name
        : nexusId;
    },
    placement: 'detail',
    help: api.laterT(
      'If you\'ve downloaded this mod from a different game section than you\'re managing, '
      + 'set this to the game the mod was intended for.\n\n'
      + 'So if you manually downloaded this mod from the Skyrim section and installed it for '
      + 'Skyrim Special Edition, set this to "Skyrim".\n\n'
      + 'Otherwise, please don\'t change this. It is required to be correct so '
      + 'Vortex can retrieve the correct mod information (including update info).'),
    edit: {
      readOnly: (mod: IModWithState) => mod.state === 'downloaded',
      choices: () => nexusGames().sort().map(game => ({ key: game.domain_name, text: game.name })),
      onChangeValue: (mods, value) => {
        const gameMode = activeGameId(api.store.getState());
        if (!Array.isArray(mods)) {
          mods = [mods];
        }
        mods.forEach(mod => {
          api.store.dispatch(setModAttribute(
            gameMode, mod.id, 'downloadGame',
            convertGameIdReverse(knownGames(api.store.getState()), value)));
        });
      },
    },
  };
}
