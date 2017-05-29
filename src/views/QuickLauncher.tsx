import { showDialog } from '../actions/notifications';
import { IDiscoveryResult } from '../extensions/gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../extensions/gamemode_management/types/IGameStored';
import { IProfile } from '../extensions/profile_management/types/IProfile';
import ToolIcon from '../extensions/starter_dashlet/ToolIcon';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../types/IDialog';
import { IDiscoveredTool } from '../types/IDiscoveredTool';
import { ComponentEx, connect } from '../util/ComponentEx';
import { showError } from '../util/message';
import { activeGameId, currentGame, currentGameDiscovery } from '../util/selectors';
import StarterInfo from '../util/StarterInfo';
import { DeployResult } from '../util/startTool';
import { getSafe } from '../util/storeHelper';
import { IconButton } from '../views/TooltipControls';

import * as Promise from 'bluebird';
import * as React from 'react';
import { DropdownButton, MenuItem } from 'react-bootstrap';

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
}

class QuickLauncher extends ComponentEx<IProps, IComponentState> {
  constructor(props: IProps) {
    super(props);
    this.initState({ starter: this.makeStarter(props) });
  }

  public componentWillReceiveProps(nextProps: IProps) {
    this.nextState.starter = this.makeStarter(nextProps);
  }

  public render(): JSX.Element {
    const { t, discoveredGames, game, knownGames, profiles } = this.props;
    const { starter } = this.state;

    if (starter === undefined) {
      return null;
    }

    const managedGamesIds = new Set<string>(Object.keys(profiles)
      .map(profileId => profiles[profileId].gameId)
      .filter(gameId => !getSafe(discoveredGames, [gameId, 'hidden'], false)));

    // TODO: this leaves out manually added games
    const managedGames = Array.from(managedGamesIds)
      .map(gameId => knownGames.find(iter => iter.id === gameId))
      .filter(iter => iter !== undefined);

    return (
      <div className='container-quicklaunch'>
        <DropdownButton
          id='dropdown-quicklaunch'
          className='btn-quicklaunch'
          title={this.renderGameOption(game, starter) as any}
          key={game.id}
          onSelect={this.changeGame}
        >
          {
            managedGames.map(managedGame => (
              <MenuItem key={managedGame.id} eventKey={managedGame.id}>
                {this.renderGameOption(managedGame)}
              </MenuItem>
              ))
          }
          <MenuItem key='__more' eventKey='__more'>{t('More...')}</MenuItem>
        </DropdownButton>
        <IconButton
          id='btn-quicklaunch-play'
          icon='caret-square-o-right'
          tooltip={t('Launch')}
          onClick={this.start}
        />
      </div>
    );
  }

  private renderGameOption = (managedGame: IGameStored, starter?: StarterInfo) => {
    const { discoveredGames } = this.props;

    const discovered = discoveredGames[managedGame.id];

    const iconPath = starter !== undefined
      ? starter.iconPath
      : StarterInfo.getGameIcon(managedGame, discovered);

    const displayName =
      getSafe(discovered, ['shortName'], getSafe(managedGame, ['shortName'], undefined))
      || getSafe(discovered, ['name'], getSafe(managedGame, ['name'], undefined));

    return (
      <div style={{ display: 'inline-block' }}>
        <div style={{ minWidth: 32, display: 'inline-block', textAlign: 'center' }} >
        <ToolIcon imageId={42} imageUrl={iconPath} valid={true} />
        </div>
        <span className='menu-label'>{displayName}</span>
      </div>
    );
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
      message: t('{{name}} cannot be started because it requires elevation. ' +
        'Would you like to run the tool elevated?', {
          replace: {
            name,
          },
        }),
      options: {
        translated: true,
      },
    }, {
        Cancel: null,
        'Run elevated': null,
      }).then(result => {
        return result.action === 'Run elevated';
      });
  }

  private queryDeploy = (): Promise<DeployResult> => {
    const { autoDeploy, onShowDialog } = this.props;
    if (autoDeploy) {
      return Promise.resolve<DeployResult>('auto');
    } else {
      return onShowDialog('question', 'Deploy now?', {
        message: 'You should deploy mods now, otherwise the mods in game '
               + 'will be outdated',
      }, {
        Cancel: null,
        Skip: null,
        Deploy: null,
      })
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
    if (gameDiscovery === undefined) {
      return undefined;
    }

    if (primaryTool === undefined) {
      return new StarterInfo(game, gameDiscovery);
    } else {
      return new StarterInfo(game, gameDiscovery,
                             game !== undefined ? game.supportedTools[primaryTool] : undefined,
                             discoveredTools[primaryTool]);
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
