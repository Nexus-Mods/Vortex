import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { getSafe } from '../../util/storeHelper';
import Icon from '../../views/Icon';

import { IDiscoveryResult, IDiscoveryState,
   IGameStored, IStateEx } from '../gamemode_management/types/IStateEx';

import { showError } from '../../util/message';

import { discoverTools, DiscoveredToolCB } from '../gamemode_management/util/discovery';

import { addDiscoveredTool, changeToolParams,
         removeDiscoveredTool } from '../gamemode_management/actions/settings';

import ToolButton from './ToolButton';
import ToolEditDialog from './ToolEditDialog';

import { v1 } from 'node-uuid';
import * as path from 'path';
import * as React from 'react';
import { Jumbotron, Media, Well } from 'react-bootstrap';
import update = require('react-addons-update');

interface IWelcomeScreenState {
  editTool: string;
  counter: number;
}

interface IActionProps {
  onAddDiscoveredTool: (gameId: string, toolId: string, result: ISupportedTool) => void;
  onRemoveDiscoveredTool: (gameId: string, toolId: string) => void;
  onChangeToolParams: (toolId: string) => void;
  onShowError: (message: string, details?: string) => void;
  onRescanTools: (gameId: string, toolId: string, result: ISupportedTool) => void;
}

interface IConnectedProps {
  gameMode: string;
  knownGames: IGame[];
  discoveredTools: { [id: string]: ISupportedTool };
}

type IWelcomeScreenProps = IConnectedProps & IActionProps;

class WelcomeScreen extends ComponentEx<IWelcomeScreenProps, IWelcomeScreenState> {
  constructor(props) {
    super(props);

    this.state = {
      editTool: undefined,
      counter: 1,
    };
  }

  public render(): JSX.Element {
    let { t, gameMode } = this.props;

    return (
      <Jumbotron>
        {this.renderEditToolDialog()}
        Welcome to Nexus Mod Manager 2!
        {gameMode === undefined ? <div>{t('No game selected')}</div> : this.renderGameMode()}
      </Jumbotron>
    );
  }

  private renderGameMode = () => {
    let { t, gameMode, knownGames } = this.props;

    let game: IGame = knownGames.find((ele) => ele.id === gameMode);

    return (
      <Well>
        <Media>
          <Media.Left>
            {this.renderGameIcon(game)}
          </Media.Left>
          <Media.Right>
            <Media.Heading>
              {game === undefined ? gameMode : game.name}
            </Media.Heading>
            <h5>
              {t('Supported Tools:')}
            </h5>
            {game === undefined ? null : this.renderSupportedToolsIcons(game)}
          </Media.Right>
        </Media>
      </Well>
    );
  }

  private renderGameIcon = (game: IGame): JSX.Element => {
    if (game === undefined) {
      // assumption is that this can only happen during startup
      return <Icon name='spinner' pulse />;
    } else {
      let logoPath = path.join(game.pluginPath, game.logo);
      return <img className='welcome-game-logo' src={logoPath} />;
    }
  }

  private renderSupportedToolsIcons = (game: IGame): JSX.Element => {
    let knownTools: ISupportedTool[] = game.supportedTools;
    let { discoveredTools } = this.props;

    if (knownTools === null) {
      return null;
    }

    let tools: ISupportedTool[] = this.mergeTools(knownTools, discoveredTools);

    return (
      <div>
        {tools.map((tool) => this.renderSupportedTool(game, tool))}
      </div>
    );
  }

  private mergeTools(knownTools: ISupportedTool[],
                     discoveredTools: { [id: string]: ISupportedTool }): ISupportedTool[] {
    let result: ISupportedTool[] = knownTools.slice();

    let lookup = result.reduce((prev: Object, current: ISupportedTool, idx: number) => {
      prev[current.id] = idx;
      return prev;
    }, {});

    Object.keys(discoveredTools).forEach((key: string) => {
      if (!(key in lookup)) {
        result.push(discoveredTools[key]);
      } else {
        result[lookup[key]] = Object.assign({}, result[lookup[key]], discoveredTools[key]);
      }
    });

    return result.filter((tool: ISupportedTool) => tool !== undefined ? !tool.hidden : null);
  }

  private renderEditToolDialog() {
    const toolId = this.state.editTool;
    if (toolId === undefined) {
      return null;
    }

    const { discoveredTools, gameMode, knownGames } = this.props;
    const game = knownGames.find((ele) => ele.id === gameMode);
    let tool: ISupportedTool = {
      id: toolId,
      custom: false,
      name: '',
      path: '',
    };
    let knownTool = game.supportedTools.find((ele) => ele.id === toolId);
    if (knownTool !== undefined) {
      tool = Object.assign({}, tool, knownTool);
    } else {
      tool.custom = true;
    }
    if (toolId in discoveredTools) {
      tool = Object.assign({}, tool, discoveredTools[toolId]);
    }

    return (
      <ToolEditDialog
        game={ game }
        tool={ tool }
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

  private renderSupportedTool =
    (game: IGame, tool: ISupportedTool): JSX.Element => {
    let { onAddDiscoveredTool, onRemoveDiscoveredTool, onRescanTools, onShowError } = this.props;

    return (
      <ToolButton
        key={`${tool.id}_${this.state.counter}`}
        game={game}
        toolId={tool.id}
        tool={tool}
        onChangeToolLocation={onAddDiscoveredTool}
        onRemoveTool={onRemoveDiscoveredTool}
        onAddNewTool={this.addNewTool}
        onChangeToolParams={this.editTool}
        onShowError={onShowError}
        onRescanTools={this.rescanTools}
      />
    );
  }

  private addNewTool = () => {
    this.setState(update(this.state, {
      editTool: { $set: v1() },
    }));
  }

  private rescanTools = () => {
    let { gameMode, knownGames } = this.props;
    discoverTools(knownGames.find((game: IGame) => game.id === gameMode),
                  this.onDiscoveredTool);
  }

  private onDiscoveredTool = (gameId: string, result: ISupportedTool) => {
    addDiscoveredTool(gameId, result.id, result);
  }

  private editTool = (toolId: string) => {
    this.setState(update(this.state, {
      editTool: { $set: toolId },
    }));
  }
};

function mapStateToProps(state: any): IConnectedProps {
  let gameMode: string = state.settings.gameMode.current;

  return {
    gameMode,
    knownGames: state.session.gameMode.known,
    discoveredTools: getSafe(state, [ 'settings', 'gameMode',
                                      'discovered', gameMode, 'tools' ], {}),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAddDiscoveredTool: (gameId: string, toolId: string, result: ISupportedTool) => {
      dispatch(addDiscoveredTool(gameId, toolId, result));
    },
    onRemoveDiscoveredTool: (gameId: string, toolId: string) => {
      dispatch(removeDiscoveredTool(gameId, toolId));
    },
    onChangeToolParams: (toolId: string) => {
      dispatch(changeToolParams(toolId));
    },
    onShowError: (message: string, details?: string) => showError(dispatch, message, details),
    onRescanTools: (gameId: string, toolId: string, result: ISupportedTool) => {
      dispatch(addDiscoveredTool(gameId, toolId, result));
    },
  };
}

export default
  translate(['common'], { wait: false })(
    connect(mapStateToProps, mapDispatchToProps)(WelcomeScreen)
  );
