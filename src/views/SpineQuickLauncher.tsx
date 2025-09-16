import { util } from '..';
import { IDiscoveryResult } from '../extensions/gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../extensions/gamemode_management/types/IGameStored';
import { IProfile } from '../extensions/profile_management/types/IProfile';
import { makeExeId } from '../reducers/session';
import { IDiscoveredTool } from '../types/IDiscoveredTool';
import { IRunningTool, IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import Debouncer from '../util/Debouncer';
import { TFunction } from '../util/i18n';
import { log } from '../util/log';
import { activeGameId, currentGame, currentGameDiscovery, activeProfile } from '../util/selectors';
import StarterInfo from '../util/StarterInfo';
import { getSafe } from '../util/storeHelper';
import { truthy } from '../util/util';
import { showError } from '../util/message';

import Promise from 'bluebird';
import * as React from 'react';
import { WithTranslation } from 'react-i18next';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { pathToFileURL } from 'url';

export interface IBaseProps {
  t: TFunction;
}

interface IConnectedProps {
  gameMode: string;
  game: IGameStored;
  gameDiscovery: IDiscoveryResult;
  discoveredTools: { [toolId: string]: IDiscoveredTool };
  primaryTool: string;
  profiles: { [profileId: string]: IProfile };
  discoveredGames: { [gameId: string]: IDiscoveryResult };
  knownGames: IGameStored[];
  lastActiveProfile: { [gameId: string]: string };
  toolsRunning: { [exePath: string]: IRunningTool };
}

interface IActionProps {
  onShowError: (message: string, details?: any, allowReport?: boolean) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps & WithTranslation;

interface IComponentState {
  gameIconCache: { [gameId: string]: { icon: string, game: IGameStored, starter: StarterInfo } };
}

class SpineQuickLauncher extends ComponentEx<IProps, IComponentState> {
  private mCacheDebouncer: Debouncer = new Debouncer(() => {
    this.nextState.gameIconCache = this.genGameIconCache();
    return Promise.resolve();
  }, 100);

  constructor(props: IProps) {
    super(props);
    this.initState({ gameIconCache: this.genGameIconCache() });
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if ((nextProps.discoveredTools !== this.props.discoveredTools)
        || (nextProps.game !== this.props.game)
        || (nextProps.gameDiscovery !== this.props.gameDiscovery)
        || (nextProps.profiles !== this.props.profiles)
        || (nextProps.discoveredGames !== this.props.discoveredGames)) {
      this.mCacheDebouncer.schedule();
    }
  }

  public render(): JSX.Element {
    const { game, toolsRunning } = this.props;
    const { gameIconCache } = this.state;

    if (!gameIconCache || Object.keys(gameIconCache).length === 0) {
      return null;
    }

    return (
      <div className="tw:flex tw:flex-col tw:gap-1 tw:p-1">
        {/* Test custom theme variables */}
        <div className="tw:bg-primary tw:dark:bg-primary-dark tw:p-1 tw:rounded tw:mb-2">
          <span className="tw:text-white tw:text-sm">Primary Theme Test</span>
        </div>

        <div className="tw:bg-accent tw:p-1 tw:rounded tw:mb-2">
          <span className="tw:text-white tw:text-sm">Accent Theme Test</span>
        </div>

        {Object.keys(gameIconCache)
          .filter(gameId => !getSafe(this.props.discoveredGames, [gameId, 'hidden'], false))
          .map(gameId => this.renderGameButton(gameId, gameId === game?.id))
        }
      </div>
    );
  }

  private renderGameButton = (gameId: string, isActive: boolean) => {
    const { toolsRunning } = this.props;
    const { gameIconCache } = this.state;

    if (!gameIconCache[gameId]) {
      return null;
    }

    const { icon, game, starter } = gameIconCache[gameId];
    const iconPath = icon ? pathToFileURL(icon).href.replace('\'', '%27') : undefined;

    const exclusiveRunning = Object.keys(toolsRunning).find(exeId => toolsRunning[exeId].exclusive) !== undefined;
    const gameRunning = starter?.exePath && Object.keys(toolsRunning).find(exeId =>
      exeId === makeExeId(starter.exePath)) !== undefined;

    const isDisabled = exclusiveRunning || gameRunning;

    return (
      <button
        key={gameId}
        className={`
          tw:w-12 tw:h-12 tw:rounded-lg tw:border-2 tw:transition-all tw:duration-200
          tw:bg-cover tw:bg-center tw:bg-no-repeat
          ${isActive
            ? 'tw:border-blue-400 tw:shadow-md tw:shadow-blue-400/20 tw:scale-105'
            : 'tw:border-gray-600 hover:tw:border-gray-400 tw:dark:border-gray-500 tw:dark:hover:border-gray-300'
          }
          ${isDisabled
            ? 'tw:opacity-50 tw:cursor-not-allowed'
            : 'hover:tw:scale-110 tw:cursor-pointer'
          }
        `}
        style={{
          backgroundImage: iconPath ? `url('${iconPath}')` : undefined,
          backgroundColor: iconPath ? 'transparent' : '#374151'
        }}
        onClick={() => !isDisabled && this.launchGame(gameId)}
        title={game.name || gameId}
        disabled={isDisabled}
      >
        {gameRunning && (
          <div className="tw:w-full tw:h-full tw:flex tw:items-center tw:justify-center tw:bg-black tw:bg-opacity-50 tw:rounded-lg">
            <div className="tw:w-4 tw:h-4 tw:border-2 tw:border-white tw:border-t-transparent tw:rounded-full tw:animate-spin"></div>
          </div>
        )}
      </button>
    );
  };

  private launchGame = (gameId: string) => {
    const { gameIconCache } = this.state;

    if (gameId === this.props.game?.id) {
      // Launch current game
      this.launchCurrentGame();
    } else {
      // Switch to game first, then launch
      this.context.api.events.emit('activate-game', gameId);
    }
  };

  private launchCurrentGame = () => {
    const { onShowError, game } = this.props;
    const { gameIconCache } = this.state;

    const starter = gameIconCache[game?.id]?.starter;
    if (!starter?.exePath) {
      onShowError('Tool missing/misconfigured',
        'Please ensure that the tool/game is configured correctly and try again', false);
      return;
    }

    this.context.api.events.emit('analytics-track-click-event', 'Spine', 'Launch game');
    const state: IState = this.context.api.store.getState();
    const profile = activeProfile(state);
    const currentModsState = util.getSafe(profile, ['modState'], false);
    const enabledMods = Object.keys(currentModsState).filter(modId => util.getSafe(currentModsState, [modId, 'enabled'], false));
    const gameMods = state.persistent.mods[profile.gameId] || {};
    const collections = Object.values(gameMods).filter((val) => (val.type == 'collection')).map((val) => val.id);
    const enabledCollections = collections.filter((collectionId) => enabledMods.includes(collectionId));

    const numberOfEnabledCollections = enabledCollections.length;
    const numberOfEnabledModsExcludingCollections = enabledMods.length - numberOfEnabledCollections;
    log('info', `Enabled mods at game launch: ${numberOfEnabledModsExcludingCollections}`);
    log('info', `Enabled collections at game launch: ${numberOfEnabledCollections}`);
    this.context.api.events.emit('analytics-track-event-with-payload', 'Launch game', {
      game_id: profile.gameId,
      enabled_mods: numberOfEnabledModsExcludingCollections,
      enabled_collections: numberOfEnabledCollections
    });
    StarterInfo.run(starter, this.context.api, onShowError);
  };

  private genGameIconCache(): { [gameId: string]: { icon: string, game: IGameStored, starter: StarterInfo } } {
    const { discoveredGames, knownGames, profiles, discoveredTools } = this.props;

    const managedGamesIds = Array.from(new Set<string>(Object.keys(profiles)
      .map(profileId => profiles[profileId].gameId)
      .filter(gameId => truthy(getSafe(discoveredGames, [gameId, 'path'], undefined)))));

    return managedGamesIds.reduce((prev, gameId) => {
      const game = knownGames.find(iter => iter.id === gameId);
      const gameDiscovery = discoveredGames[gameId];
      if (!game || !gameDiscovery) {
        return prev;
      }

      try {
        const primaryTool = getSafe(this.context.api.getState(), ['settings', 'interface', 'primaryTool', gameId], undefined);
        let starter: StarterInfo;

        if (!truthy(primaryTool) ||
            (!game.supportedTools[primaryTool] && !discoveredTools[primaryTool])) {
          starter = new StarterInfo(game, gameDiscovery);
        } else {
          try {
            if (truthy(discoveredTools[primaryTool]?.path)) {
              starter = new StarterInfo(game, gameDiscovery,
                game.supportedTools[primaryTool], discoveredTools[primaryTool]);
            } else {
              starter = new StarterInfo(game, gameDiscovery);
            }
          } catch (err) {
            starter = new StarterInfo(game, gameDiscovery);
          }
        }

        prev[gameId] = {
          icon: StarterInfo.getGameIcon(game, gameDiscovery),
          game,
          starter
        };
      } catch (err) {
        log('error', 'failed to create spine launcher entry', { gameId, error: err.message });
      }

      return prev;
    }, {});
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  const gameMode: string = activeGameId(state);

  return {
    gameMode,
    game: currentGame(state),
    gameDiscovery: currentGameDiscovery(state),
    discoveredTools: getSafe(state, ['settings', 'gameMode', 'discovered', gameMode, 'tools'], {}),
    primaryTool: getSafe(state, ['settings', 'interface', 'primaryTool', gameMode], undefined),
    knownGames: state.session.gameMode.known,
    profiles: state.persistent.profiles,
    discoveredGames: state.settings.gameMode.discovered,
    lastActiveProfile: state.settings.profiles.lastActiveProfile,
    toolsRunning: state.session.base.toolsRunning,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onShowError: (message: string, details?: string | Error, allowReport?: boolean) =>
      showError(dispatch, message, details, { allowReport }),
  };
}

export default translate(['common'])(connect(mapStateToProps, mapDispatchToProps)(
  SpineQuickLauncher)) as React.ComponentClass<IBaseProps>;