import Nexus, { NexusError, ProtocolError, RateLimitError, TimeoutError } from '@nexusmods/nexus-api';
import { TFunction } from 'i18next';
import React from 'react';
import { IconButton } from '../../../controls/TooltipControls';
import { IExtensionApi } from '../../../types/IExtensionContext';
import { IGameStored, IMod } from '../../../types/IState';
import { ITableAttribute } from '../../../types/ITableAttribute';
import { ProcessCanceled } from '../../../util/CustomErrors';
import { laterT } from '../../../util/i18n';
import { log } from '../../../util/log';
import { activeGameId, gameById } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { getGame } from '../../gamemode_management/util/getGame';
import { nexusGameId } from './convertGameId';

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
          const nexusId = nexusGameId(getGame(gameMode));
          if (!truthy(mod.attributes?.modId)) {
            return false;
          }
          return this.mTrackedMods[nexusId]?.has?.(
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
    const mods = state.persistent.mods[gameMode] ?? {};
    const downloads = state.persistent.downloads.files;

    const game: IGameStored = gameById(state, gameMode);
    const nexusId = nexusGameId(game);

    modIds.forEach(modId => {
      if (truthy(mods[modId]?.attributes?.modId)) {
        this.trackMod(nexusId, mods[modId].attributes.modId.toString?.());
      } else if (truthy(downloads[modId]?.modInfo?.nexus?.ids?.modId)) {
        this.trackMod(nexusId, downloads[modId].modInfo.nexus.ids.modId.toString());
      }
    });
  }

  public untrackMods(modIds: string[]) {
    const state = this.mApi.getState();
    const gameMode = activeGameId(state);
    const mods = state.persistent.mods[gameMode] ?? {};
    const downloads = state.persistent.downloads.files;

    const game: IGameStored = gameById(state, gameMode);
    const nexusId = nexusGameId(game);

    modIds.forEach(modId => {
      if (truthy(mods[modId]?.attributes?.modId)) {
        this.untrackMod(nexusId, mods[modId].attributes.modId.toString?.());
      } else if (truthy(downloads[modId]?.modInfo?.nexus?.ids?.modId)) {
        this.untrackMod(nexusId, downloads[modId].modInfo.nexus.ids.modId.toString());
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

      const nexusId = nexusGameId(getGame(gameMode));

      return (
        <IconButton
          icon='track'
          className='btn-embed'
          stroke={
            !this.mTrackedMods[nexusId]?.has?.(
              parseInt(mod.attributes?.modId, 10).toString(),
            )
          }
          hollow={
            !this.mTrackedMods[nexusId]?.has?.(
              parseInt(mod.attributes?.modId, 10).toString(),
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
        if (prev[iter.domain_name] === undefined) {
          prev[iter.domain_name] = new Set<string>();
        }
        prev[iter.domain_name].add(iter.mod_id.toString());
        return prev;
      }, {});
      this.mOnChanged?.();
    })
    .catch(err => {
      if (err instanceof ProcessCanceled) {
        return;
      }
      const allowReport = !(err instanceof RateLimitError)
                        && !(err instanceof TimeoutError)
                        && !(err instanceof ProtocolError)
                        && !(err instanceof NexusError);
      this.mApi.showErrorNotification('Failed to get list of tracked mods', err, {
        allowReport,
      });
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

    if (this.mTrackedMods[nexusId]?.has?.(modIdStr)) {
      this.untrackMod(nexusId, modIdStr);
    } else {
      this.trackMod(nexusId, modIdStr);
    }
  }

  private trackMod(nexusId: string, nexusModId: string) {
    if (this.mTrackedMods[nexusId]?.has?.(nexusModId)) {
      return Promise.resolve();
    }

    return this.mNexus
      .trackMod(nexusModId, nexusId)
      .then(() => {
        if (this.mTrackedMods[nexusId] === undefined) {
          this.mTrackedMods[nexusId] = new Set<string>();
        }
        this.mTrackedMods[nexusId].add(nexusModId);
        this.mOnChanged?.();
      })
      .catch((err: Error) => {
        this.mApi.showErrorNotification('Failed to track/untrack mod', err, {
          allowReport: err instanceof RateLimitError,
        });
      });
  }

  private untrackMod(nexusId: string, nexusModId: string) {
    if (!this.mTrackedMods[nexusId]?.has?.(nexusModId)) {
      return Promise.resolve();
    }

    return this.mNexus
      .untrackMod(nexusModId, nexusId)
      .then(() => {
        this.mTrackedMods[nexusId]?.delete?.(nexusModId);
        this.mOnChanged?.();
      })
      .catch((err: Error) => {
        if (err['statusCode'] === 404) {
          // user isn't actually tracking the mod
          log('warn', 'mod tracking state out of sync between server and Vortex',
            { game: nexusId, modId: nexusModId });
          this.mTrackedMods[nexusId]?.delete?.(nexusModId);
          this.mOnChanged?.();
        } else {
          this.mApi.showErrorNotification('Failed to track/untrack mod', err);
        }
      });
  }
}

export default Tracking;
