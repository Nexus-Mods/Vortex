import { IExtensionApi } from '../../../types/IExtensionContext';
import { IState } from '../../../types/IState';
import { TFunction } from '../../../util/i18n';
import { profileById } from '../../../util/selectors';
import { midClip } from '../../../util/util';
import { IHistoryEvent, IHistoryStack, Revertability } from '../../history_management/types';
import { setModEnabled } from '../../profile_management/actions/profiles';
import { IProfile } from '../../profile_management/types/IProfile';
import { setDeploymentNecessary } from '../actions/deployment';
import { setModAttribute } from '../actions/mods';
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

// some attributes we don't want to show because they are used internally as caches or something
// and shouldn't be controlled by the user
const HIDDEN_ATTRIBUTES = [
  'noContent', 'installTime', 'content', 'endorsed', 'newestFileId', 'lastUpdateTime',
];

function shorten(t: TFunction, input: any): any {
  if (typeof(input) === 'object') {
    return midClip(JSON.stringify(input), 20);
  } else if (typeof(input) === 'string') {
    return midClip(input, 20);
  } else {
    return input;
  }
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

            const profile = state.persistent.profiles[profileId];
            if (profile === undefined) {
              // the profile may not exist any more
              return false;
            }
            return (state.persistent.mods[evt.gameId]?.[id] !== undefined)
                   && profile.modState?.[id]?.enabled;
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
            const profile = state.persistent.profiles[profileId];
            if (profile === undefined) {
              // the profile may not exist any more
              return false;
            }
            return (state.persistent.mods[evt.gameId]?.[id] !== undefined)
                   && !profile.modState?.[id]?.enabled;
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
            const mod = state.persistent.mods[evt.gameId]?.[id];
            const modState = (mod !== undefined)
              ? state.persistent.mods[evt.gameId][id].state
              : undefined;
            const isStateValid = ['installed'].includes(modState);
            return isStateValid;
          },
          do: evt => this.removeMod(evt.gameId, evt.data.id),
        },
      },
      'mod-attribute-changed': {
        describe: evt =>
          api.translate('Mod "{{ name }}" attribute "{{ attribute }}" set: {{ to }}', {
            replace: {
              ...evt.data,
              to: shorten(api.translate, evt.data.to),
            },
          }),
        revert: {
          describe: evt => api.translate('Revert to {{ from }}', { replace: {
            ...evt.data,
            from: shorten(api.translate, evt.data.from),
           } }),
          possible: evt => {
            const state = api.getState();
            const { attribute, id, to } = evt.data;
            return state.persistent.mods[evt.gameId]?.[id]?.attributes?.[attribute] === to;
          },
          do: evt =>
            this.setModAttribute(evt.gameId, evt.data.id, evt.data.attribute, evt.data.from),
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
        if (addToHistory === undefined) {
          return;
        }

        Object.keys(current).forEach(gameId => {
          if (prev[gameId] !== current[gameId]) {
            Object.keys(current[gameId]).forEach(modId => {
              const prevMod = prev[gameId]?.[modId];
              const currentMod = current[gameId]?.[modId];
              if (prevMod === currentMod) {
                return;
              }

              if ((prevMod?.state !== currentMod?.state) && (currentMod?.state === 'installed')) {
                addToHistory('mods', {
                  type: 'mod-installed',
                  gameId,
                  data: {
                    id: modId,
                    name: modName(currentMod),
                  },
                });
              }

              if ((prevMod?.state === currentMod?.state) && (currentMod?.state === 'installed')) {
                // only tracking attribute changes for installed mods, not
                // for the ones set during installation
                const prevAttributes = prevMod?.attributes;
                const currentAttributes = currentMod?.attributes;

                if (prevAttributes !== currentAttributes) {
                  Object.keys(currentAttributes)
                    .forEach(attr => {
                      if (HIDDEN_ATTRIBUTES.includes(attr)) {
                        return;
                      }
                      // only track attribute _changes_, not initialization, if there was nothing
                      // set before
                      if ((prevAttributes[attr] !== undefined)
                          && (currentAttributes[attr] !== prevAttributes[attr])) {
                        addToHistory('mods', {
                          type: 'mod-attribute-changed',
                          gameId,
                          data: {
                            id: modId,
                            name: modName(currentMod),
                            attribute: attr,
                            from: prevAttributes[attr],
                            to: currentAttributes[attr],
                          },
                        });
                      }
                    });
                }
              }
            });
            Object.keys(prev[gameId] ?? {}).forEach(modId => {
              const oldState = prev[gameId]?.[modId]?.state;

              if ((current[gameId]?.[modId] === undefined)
                  && (oldState === 'installed')) {
                addToHistory('mods', {
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
      if (profile !== undefined) {
        addToHistory?.('mods', {
          type: 'will-deploy',
          gameId: profile.gameId,
          data: {},
        });
      }
    });

    this.mApi.onAsync('did-deploy', async (profileId: string) => {
      const profile = profileById(this.mApi.getState(), profileId);
      if (profile !== undefined) {
        addToHistory?.('mods', {
          type: 'did-deploy',
          gameId: profile.gameId,
          data: {},
        });
      }
    });
  }

  public get size() {
    return 100;
  }

  public describe(evt: IHistoryEvent): string {
    if (this.mEventTypes[evt.type] === undefined) {
      return `Unsupported event ${evt.type}`;
    }
    return this.mEventTypes[evt.type].describe(evt);
  }

  public describeRevert(evt: IHistoryEvent): string {
    if (this.mEventTypes[evt.type]?.revert === undefined) {
      return undefined;
    }
    return this.mEventTypes[evt.type].revert.describe(evt);
  }

  public canRevert(evt: IHistoryEvent): Revertability {
    if (this.mEventTypes[evt.type]?.revert === undefined) {
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
      const enabled = after.modState?.[modId]?.enabled;
      if ((before?.modState?.[modId]?.enabled ?? false) !== enabled) {
        const mod = this.mApi.getState().persistent.mods[after.gameId][modId];
        if (mod !== undefined) {
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

  private setModAttribute(gameId: string, modId: string, attr: string, value: any): Promise<void> {
    this.mApi.store.dispatch(setModAttribute(gameId, modId, attr, value));
    return Promise.resolve();
  }
}

export default ModHistory;
