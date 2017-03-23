import { showDialog } from '../actions/notifications';
import { IDiscoveryResult } from '../extensions/gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../extensions/gamemode_management/types/IGameStored';
import ToolIcon from '../extensions/starter_dashlet/ToolIcon';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../types/IDialog';
import { IDiscoveredTool } from '../types/IDiscoveredTool';
import { ComponentEx, connect } from '../util/ComponentEx';
import { showError } from '../util/message';
import { activeGameId, currentGame, currentGameDiscovery } from '../util/selectors';
import StarterInfo from '../util/StarterInfo';
import startTool, { DeployResult } from '../util/startTool';
import { getSafe } from '../util/storeHelper';

import * as Promise from 'bluebird';
import * as React from 'react';
import { Button } from 'react-bootstrap';

interface IConnectedProps {
  gameMode: string;
  game: IGameStored;
  gameDiscovery: IDiscoveryResult;
  discoveredTools: { [toolId: string]: IDiscoveredTool };
  autoDeploy: boolean;
  primaryTool: string;
  tabsMinimized: boolean;
}

interface IActionProps {
  onShowError: (message: string, details?: string | Error) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
}

type IProps = IConnectedProps & IActionProps;

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
    const { game } = this.props;
    const { starter } = this.state;

    return (<Button className='btn-quicklaunch' onClick={this.start}>
      <ToolIcon imageId={42} imageUrl={starter.iconPath} valid={true} />
      <span className='menu-label'>{ game.shortName || game.name }</span>
    </Button>);
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
    startTool(this.state.starter, this.queryElevate, this.queryDeploy, onShowError);
  }

  private makeStarter(props: IProps): StarterInfo {
    const { discoveredTools, game, gameDiscovery, primaryTool } = this.props;
    if (primaryTool === undefined) {
      return new StarterInfo(game, gameDiscovery);
    } else {
      return new StarterInfo(game, gameDiscovery,
                             game.supportedTools[primaryTool],
                             discoveredTools[primaryTool]);
    }
  }
}

function mapStateToProps(state: any): IConnectedProps {
  let gameMode: string = activeGameId(state);

  return {
    gameMode,
    game: currentGame(state),
    gameDiscovery: currentGameDiscovery(state),
    discoveredTools: getSafe(state, [ 'settings', 'gameMode',
                                      'discovered', gameMode, 'tools' ], {}),
    autoDeploy: state.settings.automation.deploy,
    primaryTool: getSafe(state, ['settings', 'interface', 'primaryTool', gameMode], undefined),
    tabsMinimized: getSafe(state, ['settings', 'window', 'tabsMinimized'], false),
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
  QuickLauncher
) as React.ComponentClass<{}>;
