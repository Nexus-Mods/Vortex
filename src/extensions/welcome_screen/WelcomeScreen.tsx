import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';
import { log } from '../../util/log';

import { IToolDiscoveryResult } from '../gamemode_management/types/IStateEx';

import { dialog as dialogIn, remote } from 'electron';

import { execFile } from 'child_process';
import * as path from 'path';
import * as React from 'react';
import { Jumbotron, Media, Modal, Well } from 'react-bootstrap';
import { connect } from 'react-redux';
import Icon = require('react-fontawesome');

import { Button } from '../../views/TooltipControls';
import update = require('react-addons-update');

const dialog = remote !== undefined ? remote.dialog : dialogIn;

interface IWelcomeScreenState {
  showLayer: string;
  showPage: string;
  executablePath: string;
  discoveredTool: { toolName: string, location: string };
}

interface IActionProps {
}

interface IConnectedProps {
  gameMode: string;
  knownGames: IGame[];
  knownTools: ISupportedTool[];
}

type IWelcomeScreenProps = IConnectedProps & IActionProps;

class WelcomeScreen extends React.Component<IWelcomeScreenProps, IWelcomeScreenState> {
  constructor(props) {
    super(props);

    this.state = {
      showLayer: '',
      showPage: '',
      executablePath: '',
      discoveredTool: null,
    };
  }

  public componentWillMount() {
    this.setState(update(this.state, {
      showPage: { $set: null },
    }));
  }

  public render(): JSX.Element {
    const { executablePath } = this.state;
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
  //}

  private renderGameMode = () => {
    let { gameMode, knownGames } = this.props;

    let game: IGame = knownGames.find((ele) => ele.id === gameMode);
    let logoPath: string;

    if (game !== undefined) {
      logoPath = path.join(game.pluginPath, game.logo);
    }

    return (
      <Well>
        <Media>
          <Media.Left>
            {game === undefined ? <Icon name='spinner' spin /> : <img className='welcome-game-logo' src={logoPath} />}
            <Media.Heading>
              <Media.Heading>
                Supported Tools:
                </Media.Heading>
              { this.renderSupportedToolsIcons(game) }
            </Media.Heading>
          </Media.Left>
          <Media.Right>
            <Media.Heading>
              {game === undefined ? gameMode : game.name}
            </Media.Heading>
          </Media.Right>
        </Media>
      </Well>
    );
  }

  private handleSaveExecutablePath = (event) => {
    this.handleChange(event, 'executablePath');
  }

  private handleChange(event, field) {
    let destination: string;
    let fileName: string;

    const options: Electron.OpenDialogOptions = {
      properties: ['openFile'],
    };

    dialog.showOpenDialog(null, options, (fileNames: string[]) => {
      if ((fileNames !== undefined) && (fileNames.length > 0)) {
        fileName = fileNames[0];
        this.setState(update(this.state, { [field]: { $set: fileName } }));
      }
    });
  }

  private renderSupportedToolsIcons = (game: IGame) => {
    let { knownTools } = this.props;

    //    for (let supportedTool of supportedTools) {
    //        let location = '';

    //        return (
    //            <Button
    //                classname={supportedTool.name + '-logo'}
    //                width='32'
    //                id='tool-button'
    //                tooltip={supportedTool.name}
    //                height='32'
    //                title={supportedTool.name}
    //                onClick={ this.handleSaveExecutablePath}
    //                >
    //                <img src={ fs.existsSync(path.join(game.pluginPath, supportedTool.icon)) ? path.join(game.pluginPath, location !== '' ? supportedTool.icon : supportedTool.name + '-grayscale.png') : path.join(game.pluginPath, 'image-missing.png') } height='32' width='32' />
    //            </Button>
    //        );
    //    }
  };
}

function openTool(tool: IToolDiscoveryResult) {
  execFile(tool.path, (err, data) => {
    if (err) {
      log('info', 'error', { err });
      return;
    }
  });
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    gameMode: state.settings.gameMode.current,
    knownGames: state.session.gameMode.known,
    knownTools: state.settings.gameMode.discoveredTools,
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(WelcomeScreen);
