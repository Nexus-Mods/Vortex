import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';

import { addDiscoveredTool } from '../gamemode_management/actions/settings';
import { IToolDiscoveryResult } from '../gamemode_management/types/IStateEx';

import { ToolButton } from './ToolButton';

import * as path from 'path';
import * as React from 'react';
import { Jumbotron, Media, Well } from 'react-bootstrap';
import { connect } from 'react-redux';
import Icon = require('react-fontawesome');

import update = require('react-addons-update');

interface IWelcomeScreenState {
  showLayer: string;
  showPage: string;
  executablePath: string;
}

interface IActionProps {
  onAddDiscoveredTool: (gameId: string, toolId: string, result: IToolDiscoveryResult) => void;
}

interface IConnectedProps {
  gameMode: string;
  knownGames: IGame[];
  discoveredTools: { [id: string]: IToolDiscoveryResult };
}

type IWelcomeScreenProps = IConnectedProps & IActionProps;

class WelcomeScreen extends React.Component<IWelcomeScreenProps, IWelcomeScreenState> {
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
    let { gameMode } = this.props;

    return (
      <Jumbotron>
        Welcome to Nexus Mod Manager 2!
            {gameMode === undefined ? <div>No game selected</div> : this.renderGameMode()}
      </Jumbotron>
    );
  }

  // private SaveExecutablePath = (game: string, supportedTool: ISupportedTools) => {

  //    let destination: string;
  //    let fileName: string;

  //    const options: Electron.OpenDialogOptions = {
  //        properties: ['openFile'],
  //    };

  //    dialog.showOpenDialog(null, options, (fileNames: string[]) => {
  //        if ((fileNames !== undefined) && (fileNames.length > 0)) {
  //            fileName = fileNames[0];
  //            this.setState(update(this.state, { [game]: { $set: supportedTool } }));
  //        }
  //    });
  // }

  private renderGameMode = () => {
    let { gameMode, knownGames } = this.props;

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
              Supported Tools:
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

    return (
      <ToolButton
        game={ game }
        tool={ tool }
        discovery={ toolDiscovery }
        onChangeToolLocation={ this.props.onAddDiscoveredTool }
      />
    );
  }
};

function mapStateToProps(state: any): IConnectedProps {
  let gameMode: string = state.settings.gameMode.current;
  return {
    gameMode,
    knownGames: state.session.gameMode.known,
    discoveredTools: state.settings.gameMode.discovered[gameMode].tools,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAddDiscoveredTool: (gameId: string, toolId: string, result: IToolDiscoveryResult) => {
      dispatch(addDiscoveredTool(gameId, toolId, result));
    },
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(WelcomeScreen);
