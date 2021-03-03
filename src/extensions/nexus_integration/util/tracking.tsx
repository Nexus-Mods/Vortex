import Nexus from '@nexusmods/nexus-api';
import { TFunction } from 'i18next';
import React from 'react';
import { IconButton } from '../../../controls/TooltipControls';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { IGameStored, IMod } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { laterT } from '../../../util/i18n';
import { activeGameId, gameById, knownGames } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { convertGameIdReverse, nexusGameId } from './convertGameId';

class Tracking {
  private mApi: IExtensionApi;
  private mNexus: Nexus;
  private mOnChanged: () => void;
  private mTrackedMods: { [gameId: string]: Set<string> } = {};

  constructor(api: IExtensionApi) {
    this.mApi = api;
  }

  public once(nexusInstance: Nexus) {
    this.mNexus = nexusInstance;
    const state = this.mApi.getState();
    const username = getSafe(state, ['persistent', 'nexus', 'userInfo', 'name'], undefined);
    if (username !== undefined) {
      this.fetch();
    }

    this.mApi.onStateChange(['persistent', 'nexus', 'userInfo'],
      (oldUserInfo, newUserInfo) => {
        if (newUserInfo === undefined) {
          this.mTrackedMods = {};
          this.mOnChanged?.();
        } else {
          this.fetch();
        }
    });
  }

  public attribute(): ITableAttribute {
    const TrackedIcon = this.makeIcon();
    return {
      id: 'tracked',
      name: laterT('Tracking'),
      description: laterT('Tracked on Nexus'),
      icon: 'track',
      customRenderer: (mod: IMod, detail: boolean, t: TFunction) =>
        mod.attributes?.source === 'nexus' ? (
          <TrackedIcon t={t} mod={mod} />
        ) : null,
      calc: (mod: IMod) => {
        if (mod.attributes?.source === 'nexus') {
          const gameMode = activeGameId(this.mApi.getState());
          if (mod.attributes?.modId === undefined) {
            return false;
          }
          return this.mTrackedMods[gameMode]?.has?.(
            mod.attributes?.modId.toString(),
          );
        } else {
          return undefined;
        }
      },
      externalData: (changeCB: () => void) => {
        this.mOnChanged = changeCB;
      },
      placement: 'table',
      isToggleable: true,
      isDefaultVisible: false,
      edit: {},
      isSortable: true,
    };
  }

  public trackMods(modIds: string[]) {
    const state = this.mApi.getState();
    const gameMode = activeGameId(state);
    const mods = state.persistent.mods[gameMode];
    modIds.forEach(modId => {
      if (mods[modId]?.attributes?.modId !== undefined) {
        this.trackMod(gameMode, mods[modId].attributes.modId.toString?.());
      }
    });
  }

  public untrackMods(modIds: string[]) {
    const state = this.mApi.getState();
    const gameMode = activeGameId(state);
    const mods = state.persistent.mods[gameMode];
    modIds.forEach(modId => {
      if (mods[modId]?.attributes?.modId !== undefined) {
        this.untrackMod(gameMode, mods[modId].attributes.modId.toString?.());
      }
    });
  }

  private makeIcon() {
    return (props?: { t: TFunction; mod: IMod }) => {
      const { t, mod } = props;
      const gameMode = activeGameId(this.mApi.getState());
      if (mod.attributes?.modId === undefined) {
        return null;
      }
      return (
        <IconButton
          icon='track'
          className='btn-embed'
          stroke={
            !this.mTrackedMods[gameMode]?.has?.(
              mod.attributes?.modId.toString(),
            )
          }
          hollow={
            !this.mTrackedMods[gameMode]?.has?.(
              mod.attributes?.modId.toString(),
            )
          }
          tooltip={t('Mod Tracked')}
          data-modid={mod.attributes?.modId}
          onClick={this.toggleTracked}
        />
      );
    };
  }

  private fetch() {
    if (this.mNexus.getValidationResult() === null) {
      return;
    }

    this.mNexus.getTrackedMods().then(tracked => {
      this.mTrackedMods = tracked.reduce((prev, iter) => {
        const gameId = convertGameIdReverse(
          knownGames(this.mApi.store.getState()), iter.domain_name);
        if (prev[gameId] === undefined) {
          prev[gameId] = new Set<string>();
        }
        prev[gameId].add(iter.mod_id.toString());
        return prev;
      }, {});
      this.mOnChanged?.();
    })
    .catch(err => {
      this.mApi.showErrorNotification('Failed to get tracked mods', err);
    });
  }

  private toggleTracked = (evt: React.MouseEvent<any>) => {
    const state = this.mApi.getState();
    const gameMode = activeGameId(state);
    const modIdStr: string = evt.currentTarget.getAttribute('data-modid');

    if (state.persistent['nexus']?.userInfo === undefined) {
      // user not logged in
      this.mApi.sendNotification({
        type: 'warning',
        message: 'You have to be logged in to track mods',
        displayMS: 5000,
      });
      return;
    }

    const game: IGameStored = gameById(state, gameMode);
    const nexusId = nexusGameId(game);

    if (this.mTrackedMods[gameMode]?.has?.(modIdStr)) {
      this.untrackMod(nexusId, modIdStr);
    } else {
      this.trackMod(nexusId, modIdStr);
    }
  }

  private trackMod(gameId: string, nexusModId: string) {
    if (this.mTrackedMods[gameId]?.has?.(nexusModId)) {
      return Promise.resolve();
    }

    return this.mNexus
      .trackMod(nexusModId, gameId)
      .then(() => {
        if (this.mTrackedMods[gameId] === undefined) {
          this.mTrackedMods[gameId] = new Set<string>();
        }
        this.mTrackedMods[gameId].add(nexusModId);
        this.mOnChanged?.();
      })
      .catch((err: Error) => {
        this.mApi.showErrorNotification('Failed to track/untrack mod', err);
      });
  }

  private untrackMod(gameId: string, nexusModId: string) {
    if (!this.mTrackedMods[gameId]?.has?.(nexusModId)) {
      return Promise.resolve();
    }

    return this.mNexus
      .untrackMod(nexusModId, gameId)
      .then(() => {
        this.mTrackedMods[gameId].delete(nexusModId);
        this.mOnChanged?.();
      })
      .catch((err: Error) => {
        this.mApi.showErrorNotification('Failed to track/untrack mod', err);
      });
  }
}

export default Tracking;
