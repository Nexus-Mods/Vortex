import { showDialog } from '../../actions/notifications';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../types/IDialog';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import asyncRequire, { Placeholder } from '../../util/asyncRequire';
import { ComponentEx, connect } from '../../util/ComponentEx';
import { UserCanceled } from '../../util/CustomErrors';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import StarterInfo from '../../util/StarterInfo';
import { DeployResult } from '../../util/startTool';
import { getSafe } from '../../util/storeHelper';
import Icon from '../../views/Icon';

import { addDiscoveredTool,
         setToolVisible } from '../gamemode_management/actions/settings';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { IToolStored } from '../gamemode_management/types/IToolStored';

import { setPrimaryTool } from './actions';

import ToolButton from './ToolButton';
import ToolEditDialogT from './ToolEditDialog';
let ToolEditDialog: typeof ToolEditDialogT = Placeholder;

import * as Promise from 'bluebird';
import * as path from 'path';
import * as React from 'react';
import { Dropdown, Media, MenuItem } from 'react-bootstrap';
import update = require('react-addons-update');
import { generate as shortid } from 'shortid';

interface IWelcomeScreenState {
  editTool: StarterInfo;
  counter: number;
}

interface IActionProps {
  onAddDiscoveredTool: (gameId: string, toolId: string, result: IDiscoveredTool) => void;
  onSetToolVisible: (gameId: string, toolId: string, visible: boolean) => void;
  onShowError: (message: string, details?: string | Error) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onMakePrimary: (gameId: string, toolId: string) => void;
}

interface IConnectedProps {
  gameMode: string;
  knownGames: IGameStored[];
  discoveredGames: { [id: string]: IDiscoveryResult };
  discoveredTools: { [id: string]: IDiscoveredTool };
  autoDeploy: boolean;
  primaryTool: string;
}

type IWelcomeScreenProps = IConnectedProps & IActionProps;

class Starter extends ComponentEx<IWelcomeScreenProps, IWelcomeScreenState> {
  constructor(props) {
    super(props);

    this.state = {
      editTool: undefined,
      counter: 1,
    };
  }

  public componentWillMount() {
    asyncRequire('./ToolEditDialog', __dirname)
    .then(moduleIn => {
      ToolEditDialog = moduleIn.default;
      this.forceUpdate();
    });
  }

  public render(): JSX.Element {
    let { discoveredGames, gameMode, knownGames } = this.props;

    if (gameMode === undefined) {
      return null;
    }

    const game: IGameStored = knownGames.find((ele) => ele.id === gameMode);
    const discoveredGame = discoveredGames[gameMode];
    const gameName = getSafe(discoveredGame, ['name'], getSafe(game, ['name'], gameMode));

    return (
      <Media id='starter-dashlet'>
        <Media.Left>
          {this.renderGameIcon(game, discoveredGame)}
          {this.renderEditToolDialog()}
        </Media.Left>
        <Media.Right>
          <Media.Heading>
            {gameName}
          </Media.Heading>
          {this.renderToolIcons(game, discoveredGame)}
        </Media.Right>
      </Media>
    );
  }

  private renderToolIcons(game: IGameStored, discoveredGame: IDiscoveryResult): JSX.Element {
    const { discoveredTools, primaryTool } = this.props;

    if ((game === undefined) && (discoveredGame === undefined)) {
      return null;
    }

    const gameId = discoveredGame.id || game.id;
    const knownTools: IToolStored[] = getSafe(game, ['supportedTools'], []);
    const preConfTools = new Set<string>(knownTools.map(tool => tool.id));

    // add the main game executable
    let starters: StarterInfo[] = [
      new StarterInfo(game, discoveredGame),
    ];

    // add the tools provided by the game extension (whether they are found or not)
    knownTools.forEach((tool: IToolStored) => {
      starters.push(new StarterInfo(game, discoveredGame, tool, discoveredTools[tool.id]));
    });

    // finally, add those tools that were added manually
    Object.keys(discoveredTools)
      .filter(toolId => !preConfTools.has(toolId))
      .forEach(toolId => {
        try {
          starters.push(new StarterInfo(game, discoveredGame, undefined, discoveredTools[toolId]));
        } catch (err) {
          log('error', 'tool configuration invalid', { gameId, toolId });
        }
      }
      );

    let primary = primaryTool || gameId;

    const hidden = starters.filter(starter =>
      (discoveredTools[starter.id] !== undefined)
      && (discoveredTools[starter.id].hidden === true)
    );

    const visible = starters.filter(starter =>
      starter.isGame
      || (starter.id === primary)
      || (discoveredTools[starter.id] === undefined)
      || (discoveredTools[starter.id].hidden !== true)
    );

    return (<div>
      {this.renderTool(starters.find(starter => starter.id === primary), true)}
      <div style={{ display: 'inline' }}>
        {visible.filter(starter => starter.id !== primary)
          .map(starter => this.renderTool(starter, false))}
        {this.renderAddButton(hidden)}
      </div>
    </div>);
  }

  private renderTool = (starter: StarterInfo, primary: boolean) => {
    const {t} = this.props;
    if (starter === undefined) {
      return null;
    }
    return <ToolButton
      t={t}
      key={starter.id}
      starter={starter}
      primary={primary}
      onRun={this.startTool}
      onEdit={this.editTool}
      onRemove={this.removeTool}
      onMakePrimary={this.makePrimary}
    />;
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

  private startTool = (info: StarterInfo) => {
    let startTool = require('../../util/startTool').default;
    startTool(info, this.context.api.events, this.queryElevate,
              this.queryDeploy, this.props.onShowError)
    .catch((err: Error) => {
      if (!(err instanceof UserCanceled)) {
        this.props.onShowError('Failed to deploy', err);
      }
    })
    ;
  }

  private renderAddButton(hidden: StarterInfo[]) {
    const {t} = this.props;
    // <IconButton id='add-tool-icon' icon='plus' tooltip={t('Add Tool')} />
    return (<Dropdown id='add-tool-button'>
      <Dropdown.Toggle>
        <Icon name='plus' />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {hidden.map(starter => <MenuItem
          key={starter.id}
          eventKey={starter.id}
          onSelect={this.unhide}
        >{starter.name}
        </MenuItem>)}
        <MenuItem
          key='__add'
          onSelect={this.addNewTool}
        >
        {t('New...')}
        </MenuItem>
      </Dropdown.Menu>
    </Dropdown>);
  }

  private unhide = (toolId: any) => {
    const { gameMode, onSetToolVisible }  = this.props;
    onSetToolVisible(gameMode, toolId, true);
  }

  private renderGameIcon = (game: IGameStored, discoveredGame: IDiscoveryResult): JSX.Element => {
    if ((game === undefined) && (discoveredGame === undefined)) {
      // assumption is that this can only happen during startup
      return <Icon name='spinner' pulse />;
    } else {
      let logoPath = path.join(
        getSafe(discoveredGame, ['extensionPath'], getSafe(game, ['extensionPath'], '')),
        getSafe(discoveredGame, ['logo'], getSafe(game, ['logo'], ''))
        );
      return <img className='welcome-game-logo' src={logoPath} />;
    }
  }

  private renderEditToolDialog() {
    const { editTool } = this.state;
    if (editTool === undefined) {
      return null;
    }

    return (
      <ToolEditDialog
        tool={ editTool }
        onClose={ this.closeEditDialog }
      />
    );
  }

  private closeEditDialog = () => {
    // Through the counter, which is used in the key for the tool buttons
    // this also forces all tool buttons to be re-mounted to ensure the icon is
    // correctly updated
    this.setState(update(this.state, {
      editTool: { $set: undefined },
      counter: { $set: this.state.counter + 1 },
    }));
  }

  private addNewTool = () => {
    const { gameMode, discoveredGames, knownGames } = this.props;

    let game: IGameStored = knownGames.find(ele => ele.id === gameMode);
    let empty = new StarterInfo(game, discoveredGames[gameMode], undefined, {
      id: shortid(),
      path: '',
      hidden: false,
      custom: true,
      workingDirectory: '',
      name: '',
      executable: undefined,
      requiredFiles: [],
      logo: '',
    });
    this.setState(update(this.state, {
      editTool: { $set: empty },
    }));
  }

  private editTool = (starter: StarterInfo) => {
    this.setState(update(this.state, {
      editTool: { $set: starter },
    }));
  }

  private removeTool = (starter: StarterInfo) => {
    this.props.onSetToolVisible(starter.gameId, starter.id, false);
  };

  private makePrimary = (starter: StarterInfo) => {
    this.props.onMakePrimary(starter.gameId, starter.isGame ? undefined : starter.id);
  }
};

function mapStateToProps(state: any): IConnectedProps {
  let gameMode: string = activeGameId(state);

  return {
    gameMode,
    knownGames: state.session.gameMode.known,
    discoveredGames: state.settings.gameMode.discovered,
    discoveredTools: getSafe(state, [ 'settings', 'gameMode',
                                      'discovered', gameMode, 'tools' ], {}),
    autoDeploy: state.settings.automation.deploy,
    primaryTool: getSafe(state, ['settings', 'interface', 'primaryTool', gameMode], undefined),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAddDiscoveredTool: (gameId: string, toolId: string, result: IDiscoveredTool) => {
      dispatch(addDiscoveredTool(gameId, toolId, result));
    },
    onSetToolVisible: (gameId: string, toolId: string, visible: boolean) => {
      dispatch(setToolVisible(gameId, toolId, visible));
    },
    onShowError: (message: string, details?: string | Error) =>
      showError(dispatch, message, details),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onMakePrimary: (gameId: string, toolId: string) => dispatch(setPrimaryTool(gameId, toolId)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Starter);
