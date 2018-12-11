import { showDialog } from '../actions/notifications';
import { EmptyPlaceholder } from '../controls/api';
import { IconButton } from '../controls/TooltipControls';
import { IDiscoveryResult } from '../extensions/gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../extensions/gamemode_management/types/IGameStored';
import { IProfile } from '../extensions/profile_management/types/IProfile';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../types/IDialog';
import { IDiscoveredTool } from '../types/IDiscoveredTool';
import { IState } from '../types/IState';
import { ComponentEx, connect, translate } from '../util/ComponentEx';
import { log } from '../util/log';
import { showError } from '../util/message';
import { activeGameId, currentGame, currentGameDiscovery } from '../util/selectors';
import StarterInfo from '../util/StarterInfo';
import { getSafe } from '../util/storeHelper';
import { truthy } from '../util/util';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as React from 'react';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';

export interface IBaseProps {
  t: I18next.TranslationFunction;
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
}

interface IActionProps {
  onShowError: (message: string, details?: any, allowReport?: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  starter: StarterInfo;
  gameIconCache: { [gameId: string]: { icon: string, game: IGameStored } };
}

class QuickLauncher extends ComponentEx<IProps, IComponentState> {
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

  public componentWillReceiveProps(nextProps: IProps) {
    // { discoveredTools, game, gameDiscovery, primaryTool }
    if ((nextProps.discoveredTools !== this.props.discoveredTools)
        || (nextProps.game !== this.props.game)
        || (nextProps.gameDiscovery !== this.props.primaryTool)) {
      this.nextState.starter = this.makeStarter(nextProps);
    }

    if ((nextProps.profiles !== this.props.profiles)
        || (nextProps.discoveredGames !== this.props.discoveredGames)) {
      this.nextState.gameIconCache = this.genGameIconCache();
    }
  }

  public render(): JSX.Element {
    const { t, game } = this.props;
    const { starter } = this.state;

    if (starter === undefined) {
      return null;
    }

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
          <IconButton
            id='btn-quicklaunch-play'
            onClick={this.start}
            tooltip={t('Launch')}
            icon='launch-application'
          />
        </div>
      </div>
    );
  }

  private renderGameOptions() {
    const { t, game } = this.props;
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
      .map(gameId => (
        <MenuItem key={gameId} eventKey={gameId}>
          {this.renderGameOption(gameId)}
        </MenuItem>
      ))
  }

  private renderGameOption = (gameId: string) => {
    const { discoveredGames, lastActiveProfile, profiles, profilesVisible } = this.props;
    const { gameIconCache } = this.state;

    if ((gameIconCache === undefined) || (gameIconCache[gameId] === undefined)) {
      log('error', 'failed to access game icon', { gameId });
      return '';
    }

    const discovered = discoveredGames[gameId];

    const iconPath = gameIconCache[gameId].icon.replace(/\\/g, '/');
    const game = gameIconCache[gameId].game;

    const profile = profiles[lastActiveProfile[gameId]];
    if (profile === undefined) {
      return null;
    }

    const displayName =
      getSafe(discovered, ['shortName'], getSafe(game, ['shortName'], undefined))
      || getSafe(discovered, ['name'], getSafe(game, ['name'], undefined));

    return (
      <div
        className='tool-icon-container'
        style={{ background: `url('${iconPath}')` }}
      >
        <div className='quicklaunch-item'>
          <div className='quicklaunch-name'>{displayName}</div>
          {profilesVisible ? <div className='quicklaunch-profile'>Profile: {profile.name}</div> : null}
        </div>
      </div>
    );
  }

  private genGameIconCache(): { [gameId: string]: { icon: string, game: IGameStored } } {
    const { discoveredGames, knownGames, profiles } = this.props;

    const managedGamesIds = Array.from(new Set<string>(Object.keys(profiles)
      .map(profileId => profiles[profileId].gameId)
      .filter(gameId =>
        !getSafe(discoveredGames, [gameId, 'hidden'], false)
        && truthy(getSafe(discoveredGames, [gameId, 'path'], undefined)))));

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
    if (starter === undefined) {
      return;
    }
    StarterInfo.run(starter, this.context.api, onShowError);
  }

  private makeStarter(props: IProps): StarterInfo {
    const { discoveredTools, game, gameDiscovery, primaryTool } = props;
    if ((gameDiscovery === undefined)
        || ((game === undefined) && (gameDiscovery.id === undefined))) {
      return undefined;
    }

    try {
      if ((primaryTool === undefined)
        || ((game.supportedTools[primaryTool] === undefined)
          && (discoveredTools[primaryTool] === undefined))) {
        return new StarterInfo(game, gameDiscovery);
      } else {
        try {
          return new StarterInfo(game, gameDiscovery,
            game !== undefined ? game.supportedTools[primaryTool] : undefined,
            discoveredTools[primaryTool]);
        } catch (err) {
          log('warn', 'invalid primary tool', { err });
          return new StarterInfo(game, gameDiscovery);
        }
      }
    } catch (err) {
      log('error', 'invalid game', { err });
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
