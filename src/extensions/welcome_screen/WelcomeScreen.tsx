import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { getSafe } from '../../util/storeHelper';

import { addDiscoveredTool, hideDiscoveredTool } from '../gamemode_management/actions/settings';

import { IToolDiscoveryResult } from '../gamemode_management/types/IStateEx';

import ToolButton from './ToolButton';

import * as path from 'path';
import * as React from 'react';
import { Jumbotron, Media, Well } from 'react-bootstrap';
import Icon = require('react-fontawesome');

import update = require('react-addons-update');

interface IWelcomeScreenState {
  showLayer: string;
  showPage: string;
  executablePath: string;
}

interface IActionProps {
  onAddDiscoveredTool: (gameId: string, toolId: string, result: IToolDiscoveryResult) => void;
  onRemoveDiscoveredTool: (gameId: string, toolId: string) => void;
}

interface IConnectedProps {
  gameMode: string;
  knownGames: IGame[];
  discoveredTools: { [id: string]: IToolDiscoveryResult };
}

type IWelcomeScreenProps = IConnectedProps & IActionProps;

class WelcomeScreen extends ComponentEx<IWelcomeScreenProps, IWelcomeScreenState> {
  constructor(props) {
    super(props);

    this.state = {
      showLayer: '',
      showPage: '',
      executablePath: '',
    };
  }

  public componentWillMount() {
    this.setState(update(this.state, {
      showPage: { $set: null },
    }));
  }

  public render(): JSX.Element {
    let { t, gameMode } = this.props;

    return (
      <Jumbotron>
        Welcome to Nexus Mod Manager 2!
            {gameMode === undefined ? <div>{ t('No game selected') }</div> : this.renderGameMode()}
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
          { this.renderGameIcon(game) }
          </Media.Left>
          <Media.Right>
            <Media.Heading>
              {game === undefined ? gameMode : game.name}
            </Media.Heading>
            <h5>
              { t('Supported Tools:') }
            </h5>
            {this.renderSupportedToolsIcons(game)}
          </Media.Right>
        </Media>
      </Well>
    );
  }

  private renderGameIcon = (game: IGame): JSX.Element => {
    if (game === undefined) {
      // assumption is that this can only happen during startup
      return <Icon name='spinner' spin />;
    } else {
      let logoPath = path.join(game.pluginPath, game.logo);
      return <img className='welcome-game-logo' src={logoPath} />;
    }
  }

  private renderSupportedToolsIcons = (game: IGame): JSX.Element => {
    let knownTools: ISupportedTool[] = game.supportedTools;

    if (knownTools === null) {
      return null;
    }

    return (
      <div>
        { knownTools.map((tool) => this.renderSupportedTool(game, tool)) }
      </div>
    );
  }

  private renderSupportedTool = (game: IGame, tool: ISupportedTool): JSX.Element => {
    let { discoveredTools } = this.props;

    let toolDiscovery: IToolDiscoveryResult =
      discoveredTools !== undefined ? discoveredTools[tool.id] : undefined;

    if (getSafe(toolDiscovery, ['hidden'], false) === true) {
      return null;
    }

    return (
      <ToolButton
        key={ tool.id }
        game={ game }
        tool={ tool }
        discovery={ toolDiscovery }
        onChangeToolLocation={ this.props.onAddDiscoveredTool }
        onRemoveTool={this.props.onRemoveDiscoveredTool}
      />
    );
  }
};

function mapStateToProps(state: any): IConnectedProps {
  let gameMode: string = state.settings.gameMode.current;
  let discovered = state.settings.gameMode.discovered[gameMode];

  return {
    gameMode,
    knownGames: state.session.gameMode.known,
    discoveredTools: discovered !== undefined ? discovered.tools : undefined,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAddDiscoveredTool: (gameId: string, toolId: string, result: IToolDiscoveryResult) => {
    dispatch(addDiscoveredTool(gameId, toolId, result));
    },
    onRemoveDiscoveredTool: (gameId: string, toolId: string) => {
    dispatch(hideDiscoveredTool(gameId, toolId));
    },
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(WelcomeScreen)
  );
