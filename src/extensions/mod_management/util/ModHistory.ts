import { IExtensionApi } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { profileById } from '../../../util/selectors';
import { IHistoryEvent, IHistoryStack, Revertability } from '../../history_management/types';
import { setModEnabled } from '../../profile_management/actions/profiles';
import { IProfile } from '../../profile_management/types/IProfile';
import { setDeploymentNecessary } from '../actions/deployment';
import modName from './modName';

export type EventTypes = 'mod-enabled' | 'mod-disabled' | 'mod-installed' | 'mod-installed'
                       | 'will-deploy' | 'did-deploy';

interface IEventType {
  describe: (evt: IHistoryEvent) => string;
  revert?: {
    describe: (evt: IHistoryEvent) => string;
    possible: (evt: IHistoryEvent) => boolean;
    do: (evt: IHistoryEvent) => Promise<void>;
  };
}

class ModHistory implements IHistoryStack {
  private mApi: IExtensionApi;
  private mEventTypes: { [key: string]: IEventType };

  constructor(api: IExtensionApi) {
    this.mApi = api;

    this.mEventTypes = {
      'mod-enabled': {
        describe: evt =>
          api.translate('Mod was enabled: {{ name }} (Profile: {{ profileName }})',
                        { replace: evt.data }),
        revert: {
          describe: evt => api.translate('Disable mod', { replace: evt.data }),
          possible: evt => {
            const state = api.getState();
            const { id, profileId } = evt.data;
            return (state.persistent.mods[evt.gameId]?.[id] !== undefined)
                   && state.persistent.profiles[profileId].modState[id].enabled;
          },
          do: evt => {
            const profile = profileById(api.getState(), evt.data.profileId);
            api.store.dispatch(setModEnabled(evt.data.profileId, evt.data.id, false));
            api.store.dispatch(setDeploymentNecessary(profile.gameId, true));
            return Promise.resolve();
          },
        },
      },
      'mod-disabled': {
        describe: evt =>
          api.translate('Mod was disabled: {{ name }} (Profile: {{ profileName }})',
                        { replace: evt.data }),
        revert: {
          describe: evt => api.translate('Enable mod', { replace: evt.data}),
          possible: evt => {
            const state = api.getState();
            const { id, profileId } = evt.data;
            return (state.persistent.mods[evt.gameId]?.[id] !== undefined)
                   && !state.persistent.profiles[profileId].modState[id].enabled;
          },
          do: evt => {
            const profile = profileById(api.getState(), evt.data.profileId);
            api.store.dispatch(setModEnabled(evt.data.profileId, evt.data.id, true));
            api.store.dispatch(setDeploymentNecessary(profile.gameId, true));
            return Promise.resolve();
          },
        },
      },
      'mod-uninstalled': {
        describe: evt =>
          api.translate('Mod was uninstalled: {{ name }}', { replace: evt.data }),
      },
      'mod-installed': {
        describe: evt =>
          api.translate('Mod was installed: {{ name }}', { replace: evt.data }),
        revert: {
          describe: evt => api.translate('Uninstall mod', { replace: evt.data}),
          possible: evt => {
            const state = api.getState();
            const { id } = evt.data;
            return state.persistent.mods[evt.gameId]?.[id] !== undefined;
          },
          do: evt => this.removeMod(evt.gameId, evt.data.id),
        },
      },
      'will-deploy': {
        describe: evt => api.translate('Deployment started'),
      },
      'did-deploy': {
        describe: evt => api.translate('Deployment finished'),
      },
    };
  }

  public init() {
    const state: IState = undefined;

    const addToHistory: (stack: string, entry: IHistoryEvent) => void =
      this.mApi.ext.addToHistory;

    this.mApi.onStateChange<typeof state.persistent.profiles>(['persistent', 'profiles'],
      (prev, current) => {
        Object.keys(current).forEach(profileId => {
          if (prev[profileId] !== current[profileId]) {
            this.triggerEnabledEvents(prev[profileId], current[profileId]);
          }
        });
    });

    this.mApi.onStateChange<typeof state.persistent.mods>(['persistent', 'mods'],
      (prev, current) => {
        Object.keys(current).forEach(gameId => {
          if (prev[gameId] !== current[gameId]) {
            Object.keys(current[gameId]).forEach(modId => {
              if (prev[gameId]?.[modId] === undefined) {
                addToHistory?.('mods', {
                  type: 'mod-installed',
                  gameId,
                  data: {
                    id: modId,
                    name: modName(current[gameId][modId]),
                  },
                });
              }
            });
            Object.keys(prev[gameId]).forEach(modId => {
              if (current[gameId]?.[modId] === undefined) {
                addToHistory?.('mods', {
                  type: 'mod-uninstalled',
                  gameId,
                  data: {
                    id: modId,
                    name: modName(prev[gameId][modId]),
                  },
                });
              }
            });
          }
        });
    });

    this.mApi.onAsync('will-deploy', async (profileId: string) => {
      const profile = profileById(this.mApi.getState(), profileId);
      addToHistory?.('mods', {
        type: 'will-deploy',
        gameId: profile.gameId,
        data: {},
      });
    });

    this.mApi.onAsync('did-deploy', async (profileId: string) => {
      const profile = profileById(this.mApi.getState(), profileId);
      addToHistory?.('mods', {
        type: 'did-deploy',
        gameId: profile.gameId,
        data: {},
      });
    });
  }

  public get size() {
    return 100;
  }

  public describe(evt: IHistoryEvent): string {
    if (this.mEventTypes[evt.type] === undefined) {
      return `Unsupported event ${evt.type}: ${JSON.stringify(evt.data)}`;
    }
    return this.mEventTypes[evt.type].describe(evt);
  }

  public describeRevert(evt: IHistoryEvent): string {
    if (this.mEventTypes[evt.type] === undefined) {
      return `Unsupported event ${evt.type}: ${JSON.stringify(evt.data)}`;
    }
    if (this.mEventTypes[evt.type].revert === undefined) {
      return undefined;
    }
    return this.mEventTypes[evt.type].revert.describe(evt);
  }

  public canRevert(evt: IHistoryEvent): Revertability {
    if (this.mEventTypes[evt.type].revert === undefined) {
      return 'never';
    } else if (!this.mEventTypes[evt.type].revert.possible(evt)) {
      return 'invalid';
    }
    return 'yes';
  }

  public revert(evt: IHistoryEvent): Promise<void> {
    return this.mEventTypes[evt.type].revert.do(evt);
  }

  private triggerEnabledEvents(before: IProfile, after: IProfile) {
    const addToHistory: (stack: string, entry: IHistoryEvent) => void = this.mApi.ext.addToHistory;

    Object.keys(after.modState ?? {}).forEach(modId => {
      const { enabled } = after.modState[modId];
      if ((before?.modState?.[modId].enabled ?? false) !== enabled) {
        const mod = this.mApi.getState().persistent.mods[after.gameId][modId];
        addToHistory?.('mods', {
          type: enabled ? 'mod-enabled' : 'mod-disabled',
          gameId: after.gameId,
          data: {
            id: modId,
            name: modName(mod),
            profileId: after.id,
            profileName: after.name,
          },
        });
      }
    });
  }

  private removeMod(gameId: string, modId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.mApi.events.emit('remove-mod', gameId, modId, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}

export default ModHistory;
