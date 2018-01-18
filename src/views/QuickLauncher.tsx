import { showDialog } from '../actions/notifications';
import Icon from '../controls/Icon';
import { Button, IconButton } from '../controls/TooltipControls';
import { IDiscoveryResult } from '../extensions/gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../extensions/gamemode_management/types/IGameStored';
import { IProfile } from '../extensions/profile_management/types/IProfile';
import ToolIcon from '../extensions/starter_dashlet/ToolIcon';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../types/IDialog';
import { IDiscoveredTool } from '../types/IDiscoveredTool';
import { ComponentEx, connect } from '../util/ComponentEx';
import { log } from '../util/log';
import { showError } from '../util/message';
import { activeGameId, currentGame, currentGameDiscovery } from '../util/selectors';
import StarterInfo from '../util/StarterInfo';
import { DeployResult } from '../util/startTool';
import { getSafe } from '../util/storeHelper';

import * as Promise from 'bluebird';
import * as I18next from 'i18next';
import * as path from 'path';
import * as React from 'react';
import { DropdownButton, MenuItem } from 'react-bootstrap';
import * as Redux from 'redux';

export interface IBaseProps {
  t: I18next.TranslationFunction;
}

interface IConnectedProps {
  gameMode: string;
  game: IGameStored;
  gameDiscovery: IDiscoveryResult;
  discoveredTools: { [toolId: string]: IDiscoveredTool };
  autoDeploy: boolean;
  primaryTool: string;
  tabsMinimized: boolean;
  profiles: { [profileId: string]: IProfile };
  discoveredGames: { [gameId: string]: IDiscoveryResult };
  knownGames: IGameStored[];
}

interface IActionProps {
  onShowError: (message: string, details?: string | Error) => void;
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
    this.context.api.events.on('quick-launch', () => {
      this.start();
    });
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
    const { t, discoveredGames, game, knownGames, profiles } = this.props;
    const { gameIconCache, starter } = this.state;

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
          {
            Object.keys(gameIconCache)
              .filter(gameId => gameId !== game.id)
              .map(gameId => (
              <MenuItem key={gameId} eventKey={gameId}>
                {this.renderGameOption(gameId)}
              </MenuItem>
              ))
          }
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

  private renderGameOption = (gameId: string) => {
    const { t, discoveredGames } = this.props;
    const { gameIconCache } = this.state;

    if ((gameIconCache === undefined) || (gameIconCache[gameId] === undefined)) {
      log('error', 'failed to access game icon', { gameId });
      return null;
    }

    const discovered = discoveredGames[gameId];

    const iconPath = gameIconCache[gameId].icon.replace(/\\/g, '/');
    const game = gameIconCache[gameId].game;

    const displayName =
      getSafe(discovered, ['shortName'], getSafe(game, ['shortName'], undefined))
      || getSafe(discovered, ['name'], getSafe(game, ['name'], undefined));

    return (
      <div
        className='tool-icon-container'
        style={{ background: `url('${iconPath}')` }}
      >
        <span className='menu-label'>{displayName}</span>
      </div>
    );
  }

  private genGameIconCache(): { [gameId: string]: { icon: string, game: IGameStored } } {
    const { discoveredGames, knownGames, profiles } = this.props;

    const managedGamesIds = Array.from(new Set<string>(Object.keys(profiles)
      .map(profileId => profiles[profileId].gameId)
      .filter(gameId => !getSafe(discoveredGames, [gameId, 'hidden'], false))));

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

  private queryElevate = (name: string) => {
    const { t, onShowDialog } = this.props;
    return onShowDialog('question', t('Requires elevation'), {
      message: t('{{name}} needs to be run as administrator.', {
          replace: {
            name,
          },
        }),
      options: {
        translated: true,
      },
    }, [ { label: 'Cancel' }, { label: 'Run as administrator' } ])
    .then(result => result.action === 'Run as administrator');
  }

  private queryDeploy = (): Promise<DeployResult> => {
    const { autoDeploy, onShowDialog } = this.props;
    if (autoDeploy) {
      return Promise.resolve<DeployResult>('auto');
    } else {
      return onShowDialog('question', 'Deploy now?', {
        message: 'You should deploy mods now, otherwise the mods in game '
               + 'will be outdated',
      }, [ { label: 'Cancel' }, { label: 'Skip' }, { label: 'Deploy' } ])
      .then((result) => {
        switch (result.action) {
          case 'Skip': return Promise.resolve<DeployResult>('skip');
          case 'Deploy': return Promise.resolve<DeployResult>('yes');
          default: return Promise.resolve<DeployResult>('cancel');
        }
      });
    }
  }

  private start = () => {
    const { onShowError } = this.props;
    const startTool = require('../util/startTool').default;
    startTool(this.state.starter, this.context.api.events,
              this.queryElevate, this.queryDeploy, onShowError);
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

function mapStateToProps(state: any): IConnectedProps {
  const gameMode: string = activeGameId(state);

  return {
    gameMode,
    game: currentGame(state),
    gameDiscovery: currentGameDiscovery(state),
    discoveredTools: getSafe(state, [ 'settings', 'gameMode',
                                      'discovered', gameMode, 'tools' ], {}),
    autoDeploy: state.settings.automation.deploy,
    primaryTool: getSafe(state, ['settings', 'interface', 'primaryTool', gameMode], undefined),
    tabsMinimized: getSafe(state, ['settings', 'window', 'tabsMinimized'], false),

    knownGames: state.session.gameMode.known,
    profiles: state.persistent.profiles,
    discoveredGames: state.settings.gameMode.discovered,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onShowError: (message: string, details?: string | Error) =>
      showError(dispatch, message, details),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(
  QuickLauncher) as React.ComponentClass<IBaseProps>;
