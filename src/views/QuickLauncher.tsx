import { showDialog } from '../actions/notifications';
import EmptyPlaceholder from '../controls/EmptyPlaceholder';
import Spinner from '../controls/Spinner';
import { IconButton } from '../controls/TooltipControls';
import { IDiscoveryResult } from '../extensions/gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../extensions/gamemode_management/types/IGameStored';
import { IProfile } from '../extensions/profile_management/types/IProfile';
import { makeExeId } from '../reducers/session';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../types/IDialog';
import { IDiscoveredTool } from '../types/IDiscoveredTool';
import { IRunningTool, IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import Debouncer from '../util/Debouncer';
import { TFunction } from '../util/i18n';
import { log } from '../util/log';
import { showError } from '../util/message';
import { activeGameId, currentGame, currentGameDiscovery } from '../util/selectors';
import StarterInfo from '../util/StarterInfo';
import { getSafe } from '../util/storeHelper';
import { truthy } from '../util/util';

import Promise from 'bluebird';
import * as React from 'react';
import { DropdownButton, MenuItem } from 'react-bootstrap';
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
  tabsMinimized: boolean;
  profiles: { [profileId: string]: IProfile };
  discoveredGames: { [gameId: string]: IDiscoveryResult };
  knownGames: IGameStored[];
  profilesVisible: boolean;
  lastActiveProfile: { [gameId: string]: string };
  toolsRunning: { [exePath: string]: IRunningTool };
}

interface IActionProps {
  onShowError: (message: string, details?: any, allowReport?: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
}

type IProps = IBaseProps & IConnectedProps & IActionProps & WithTranslation;

interface IComponentState {
  starter: StarterInfo;
  gameIconCache: { [gameId: string]: { icon: string, game: IGameStored } };
}

class QuickLauncher extends ComponentEx<IProps, IComponentState> {
  private mCacheDebouncer: Debouncer = new Debouncer(() => {
    this.nextState.gameIconCache = this.genGameIconCache();
    return Promise.resolve();
  }, 100);

  constructor(props: IProps) {
    super(props);
    this.initState({ starter: this.makeStarter(props), gameIconCache: this.genGameIconCache() });
  }

  public componentDidMount() {
    this.context.api.events.on('quick-launch', this.start);
  }

  public componentWillUnmount() {
    this.context.api.events.removeListener('quick-launch', this.start);
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if ((nextProps.discoveredTools !== this.props.discoveredTools)
        || (nextProps.game !== this.props.game)
        || (nextProps.gameDiscovery !== this.props.primaryTool)) {
      this.nextState.starter = this.makeStarter(nextProps);
    }

    if ((nextProps.profiles !== this.props.profiles)
        || (nextProps.discoveredGames !== this.props.discoveredGames)) {
      this.mCacheDebouncer.schedule();
    }
  }

  public render(): JSX.Element {
    const { t, game, toolsRunning } = this.props;
    const { starter } = this.state;

    if (starter === undefined) {
      return null;
    }

    const exclusiveRunning =
      Object.keys(toolsRunning).find(exeId => toolsRunning[exeId].exclusive) !== undefined;
    const primaryRunning = (truthy(starter.exePath))
      && Object.keys(toolsRunning).find(exeId =>
        exeId === makeExeId(starter.exePath)) !== undefined;

    return (
      <div className='container-quicklaunch'>
        <DropdownButton
          id='dropdown-quicklaunch'
          className='btn-quicklaunch'
          title={this.renderGameOption(game.id) as any}
          key={game.id}
          onSelect={this.changeGame}
          noCaret
        >
          {this.renderGameOptions()}
        </DropdownButton>
        <div className='container-quicklaunch-launch'>
          {exclusiveRunning || primaryRunning ? (
            <Spinner />
          ) : (
            <IconButton
              id='btn-quicklaunch-play'
              onClick={this.start}
              tooltip={t('Launch')}
              icon='launch-application'
            />
          )}
        </div>
      </div>
    );
  }

  private renderGameOptions() {
    const { t, discoveredGames, game } = this.props;
    const { gameIconCache } = this.state;
    if (Object.keys(gameIconCache).length === 1) {
      return (
        <MenuItem key='no-other-games' disabled={true}>
          <EmptyPlaceholder
            icon='layout-list'
            text={t('No other games managed')}
          />
        </MenuItem>
      );
    }

    return Object.keys(gameIconCache)
      .filter(gameId => gameId !== game.id)
      .filter(gameId => !getSafe(discoveredGames, [gameId, 'hidden'], false))
      .map(gameId => (
        <MenuItem key={gameId} eventKey={gameId}>
          {this.renderGameOption(gameId)}
        </MenuItem>
      ));
  }

  private renderGameOption = (gameId: string) => {
    const { t, discoveredGames, lastActiveProfile, profiles, profilesVisible } = this.props;
    const { gameIconCache } = this.state;

    if ((gameIconCache === undefined) || (gameIconCache[gameId] === undefined)) {
      log('error', 'failed to access game icon', { gameId });
      return '';
    }

    const discovered = discoveredGames[gameId];

    const iconPath = (gameIconCache[gameId].icon !== undefined)
      ? pathToFileURL(gameIconCache[gameId].icon).href.replace('\'', '%27')
      : undefined;
    const game = gameIconCache[gameId].game;

    const profile = profiles[lastActiveProfile[gameId]];

    let displayName =
      getSafe(discovered, ['shortName'], getSafe(game, ['shortName'], undefined))
      || getSafe(discovered, ['name'], getSafe(game, ['name'], undefined));

    if (displayName !== undefined) {
      displayName = displayName.replace(/\t/g, ' ');
    }

    return (
      <div
        className='tool-icon-container'
        style={{ background: `url('${iconPath}')` }}
      >
        <div className='quicklaunch-item'>
          <div className='quicklaunch-name'>{t(displayName)}</div>
          {profilesVisible
            ? (
              <div className='quicklaunch-profile'>
                {t('Profile')} : {profile?.name ?? t('<None>')}
              </div>
            ) : null}
        </div>
      </div>
    );
  }

  private genGameIconCache(): { [gameId: string]: { icon: string, game: IGameStored } } {
    const { discoveredGames, knownGames, profiles } = this.props;

    const managedGamesIds = Array.from(new Set<string>(Object.keys(profiles)
      .map(profileId => profiles[profileId].gameId)
      .filter(gameId => truthy(getSafe(discoveredGames, [gameId, 'path'], undefined)))));

    return managedGamesIds.reduce((prev, gameId) => {
      const game = knownGames.find(iter => iter.id === gameId);
      if ((game === undefined) || (discoveredGames[gameId] === undefined)) {
        return prev;
      }
      prev[gameId] = {
        icon: StarterInfo.getGameIcon(game, discoveredGames[gameId]),
        game,
      };
      return prev;
    }, {});
  }

  private changeGame = (gameId) => {
    if (gameId === '__more') {
      this.context.api.events.emit('show-main-page', 'Games');
    } else {
      this.context.api.events.emit('activate-game', gameId);
    }
  }

  private start = () => {
    const { onShowError } = this.props;
    const { starter } = this.state;
    if (starter?.exePath === undefined) {
      onShowError('Tool missing/misconfigured',
        'Please ensure that the tool/game is configured correctly and try again', false);
      return;
    }
    this.context.api.events.emit('analytics-track-click-event', 'Header', 'Play game');
    StarterInfo.run(starter, this.context.api, onShowError);
  }

  private makeStarter(props: IProps): StarterInfo {
    const { discoveredTools, game, gameDiscovery, primaryTool } = props;
    if ((gameDiscovery === undefined)
        || (gameDiscovery.path === undefined)
        || ((game === undefined) && (gameDiscovery.id === undefined))) {
      return undefined;
    }

    try {
      if (!truthy(primaryTool)
        || ((game.supportedTools[primaryTool] === undefined)
          && (discoveredTools[primaryTool] === undefined))) {
        return new StarterInfo(game, gameDiscovery);
      } else {
        try {
          if (truthy(discoveredTools[primaryTool].path)) {
            return new StarterInfo(game, gameDiscovery,
              game !== undefined ? game.supportedTools[primaryTool] : undefined,
              discoveredTools[primaryTool]);
          } else {
            // Annoying, but a valid issue where for some reason the tool's
            //  path has been manually deleted by the user OR is undefined.
            throw new Error('invalid path to primary tool');
          }
        } catch (err) {
          log('warn', 'invalid primary tool', { err });
          return new StarterInfo(game, gameDiscovery);
        }
      }
    } catch (err) {
      log('error', 'failed to create quick launcher entry', { error: err.message, stack: err.stack });
      return undefined;
    }
  }
}

function mapStateToProps(state: IState): IConnectedProps {
  const gameMode: string = activeGameId(state);

  return {
    gameMode,
    game: currentGame(state),
    gameDiscovery: currentGameDiscovery(state),
    discoveredTools: getSafe(state, [ 'settings', 'gameMode',
                                      'discovered', gameMode, 'tools' ], {}),
    primaryTool: getSafe(state, ['settings', 'interface', 'primaryTool', gameMode], undefined),
    tabsMinimized: getSafe(state, ['settings', 'window', 'tabsMinimized'], false),

    knownGames: state.session.gameMode.known,
    profiles: state.persistent.profiles,
    discoveredGames: state.settings.gameMode.discovered,
    profilesVisible: state.settings.interface.profilesVisible,
    lastActiveProfile: state.settings.profiles.lastActiveProfile,
    toolsRunning: state.session.base.toolsRunning,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onShowError: (message: string, details?: string | Error, allowReport?: boolean) =>
      showError(dispatch, message, details, { allowReport }),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default translate(['common'])(connect(mapStateToProps, mapDispatchToProps)(
  QuickLauncher)) as React.ComponentClass<IBaseProps>;
