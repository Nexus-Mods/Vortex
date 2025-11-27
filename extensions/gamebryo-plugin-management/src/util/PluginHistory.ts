import * as path from 'path';
import { selectors, types } from 'vortex-api';
import { setPluginEnabled } from '../actions/loadOrder';
import { GHOST_EXT } from '../statics';
import { ILoadOrder } from '../types/ILoadOrder';
import { IStateEx } from '../types/IStateEx';

export type EventTypes = 'plugin-enabled' | 'plugin-disabled' | 'plugins-sorted';

interface IEventType {
  describe: (evt: types.IHistoryEvent) => string;
  revert?: {
    describe: (evt: types.IHistoryEvent) => string;
    possible: (evt: types.IHistoryEvent) => boolean;
    do: (evt: types.IHistoryEvent) => Promise<void>;
  };
}

class PluginHistory implements types.IHistoryStack {
  private mApi: types.IExtensionApi;
  private mEventTypes: { [key: string]: IEventType };

  constructor(api: types.IExtensionApi,
              setPluginGhost: (pluginId: string, gameId: string,
                               ghosted: boolean, enabled: boolean) => void,
              setPluginLight: (pluginId: string, enable: boolean) => void) {
    this.mApi = api;

    const renderAct = (data) => {
      return (data.oldState === true)
        ? 'Enable'
        : (data.wasGhost === 'ghost')
        ? 'Ghost'
        : 'Disable';
    };

    this.mEventTypes = {
      'plugin-enabled': {
        describe: evt =>
          api.translate('Plugin was enabled: {{ name }} (Profile: {{ profileName }})',
                        { replace: evt.data }),
        revert: {
          describe: evt => api.translate('{{oldState}} plugin', { replace: {
            oldState: renderAct(evt.data) }}),
          possible: evt => {
            const state: IStateEx = this.mApi.getState();
            const profile = selectors.activeProfile(state);
            if (profile.id !== evt.data.profileId) {
              return false;
            }
            return state.loadOrder[evt.data.id]?.enabled === true;
          },
          do: evt => {
            if (evt.data.wasGhost) {
              const state: IStateEx = this.mApi.getState();
              const profile = selectors.activeProfile(state);
              setPluginGhost(evt.data.id, profile.gameId, true, false);
            } else {
              api.store.dispatch(setPluginEnabled(evt.data.id, evt.data.oldState));
            }
            return Promise.resolve();
          },
        },
      },
      'plugin-disabled': {
        describe: evt =>
          api.translate('Plugin was disabled: {{ name }} (Profile: {{ profileName }})',
                        { replace: evt.data }),
        revert: {
          describe: evt => api.translate('{{oldState}} plugin', { replace: {
            oldState: renderAct(evt.data) }}),
          possible: evt => {
            const state: IStateEx = this.mApi.getState();
            const profile = selectors.activeProfile(state);
            if (profile.id !== evt.data.profileId) {
              return false;
            }
            return state.loadOrder[evt.data.id]?.enabled === false;
          },
          do: evt => {
            if (evt.data.wasGhost) {
              const state: IStateEx = this.mApi.getState();
              const profile = selectors.activeProfile(state);
              setPluginGhost(evt.data.id, profile.gameId, true, false);
            } else {
              api.store.dispatch(setPluginEnabled(evt.data.id, evt.data.oldState));
            }
            return Promise.resolve();
          },
        },
      },
      'plugin-ghosted': {
        describe: evt =>
          api.translate('Plugin was ghosted: {{ name }} (Profile: {{ profileName }})',
                        { replace: evt.data }),
        revert: {
          describe: evt => api.translate('{{oldState}} plugin', { replace: {
            oldState: renderAct(evt.data) }}),
          possible: evt => {
            const state: IStateEx = this.mApi.getState();
            const profile = selectors.activeProfile(state);
            if (profile.id !== evt.data.profileId) {
              return false;
            }
            const plugin = state.session.plugins.pluginList[evt.data.id];
            if (plugin === undefined) {
              return false;
            }
            return path.extname(plugin.filePath).toLowerCase() === GHOST_EXT;
          },
          do: evt => {
            const state: IStateEx = this.mApi.getState();
            const profile = selectors.activeProfile(state);
            setPluginGhost(evt.data.id, profile.gameId, false, true);
            return Promise.resolve();
          },
        },
      },
      'plugin-eslified': {
        describe: evt =>
          api.translate('Plugin was converted to {{ conversion }}: {{ name }}', {
            replace: {
              name: evt.data.id,
              conversion: evt.data.enable ? 'light' : 'regular',
            },
          }),
        revert: {
          describe: evt => api.translate('Convert to {{ conversion }}', {
            replace: {
              conversion: evt.data.enable ? 'regular' : 'light',
            },
          }),
          possible: evt => {
            const state: IStateEx = this.mApi.getState();
            const plugin = state.session.plugins.pluginList[evt.data.id];
            if (plugin === undefined) {
              return false;
            }
            // TODO we currently only validate the plugin exist, not whether it still has the
            // expected flag because that information is cached in PluginList and not easily
            // accessible here.
            // that should be refactored though
            return true;
          },
          do: evt => {
            try {
              setPluginLight(evt.data.id, !evt.data.enable);
              return Promise.resolve();
            } catch (err) {
              if (err.code === 'ENOENT') {
                api.showErrorNotification('File no longer exists', err, {
                  message: err.path,
                  allowReport: false,
                });
                return Promise.resolve();
              }
              return Promise.reject(err);
            }
          },
        },
      },
      'plugins-sorted': {
        describe: evt =>
          api.translate('Plugins were sorted'),
      },
   };
  }

  public init() {
    const addToHistory: (stack: string, entry: types.IHistoryEvent) => void =
      this.mApi.ext.addToHistory;

    interface IPluginMap { [pluginId: string]: ILoadOrder; }

    this.mApi.onStateChange(['loadOrder'], (prev: IPluginMap, current: IPluginMap) => {
      const allIds = Array.from(new Set<string>(
        [].concat(Object.keys(prev), Object.keys(current))));

      const state: IStateEx = this.mApi.getState();
      const gameMode = selectors.activeGameId(state);
      const profile = selectors.activeProfile(state);

      if (profile !== undefined) {
        allIds.forEach(id => {
          if ((prev[id]?.enabled !== undefined)
            && (prev[id]?.enabled !== current[id]?.enabled)) {
            const plugin = state.session.plugins.pluginList?.[id];
            const ghost = (plugin !== undefined)
              && (path.extname(plugin.filePath).toLowerCase() === GHOST_EXT);
            addToHistory('plugins', {
              type: current[id]?.enabled === true
                ? 'plugin-enabled'
                : ghost
                  ? 'plugin-ghosted'
                  : 'plugin-disabled',
              gameId: gameMode,
              data: {
                id,
                oldState: prev[id]?.enabled ?? false,
                name: path.basename(plugin?.filePath ?? id, GHOST_EXT),
                wasGhost: ghost,
                profileId: profile.id,
                profileName: profile.name,
              },
            });
          }
        });
      }
    });

    this.mApi.events.on('autosort-plugins', () => {
      const state: IStateEx = this.mApi.getState();
      const gameMode = selectors.activeGameId(state);

      addToHistory('plugins', {
        type: 'plugins-sorted',
        gameId: gameMode,
        data: {},
      });
    });
  }

  public get size() {
    return 100;
  }

  public describe(evt: types.IHistoryEvent): string {
    if (this.mEventTypes[evt.type] === undefined) {
      return `Unsupported event ${evt.type}`;
    }
    return this.mEventTypes[evt.type].describe(evt);
  }

  public describeRevert(evt: types.IHistoryEvent): string {
    if (this.mEventTypes[evt.type]?.revert === undefined) {
      return undefined;
    }
    return this.mEventTypes[evt.type].revert.describe(evt);
  }

  public canRevert(evt: types.IHistoryEvent): types.Revertability {
    if (this.mEventTypes[evt.type]?.revert === undefined) {
      return 'never';
    } else if (!this.mEventTypes[evt.type].revert.possible(evt)) {
      return 'invalid';
    }
    return 'yes';
  }

  public revert(evt: types.IHistoryEvent): Promise<void> {
    return this.mEventTypes[evt.type].revert.do(evt);
  }
}

export default PluginHistory;
