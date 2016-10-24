import { IGame } from '../../types/IGame';
import { ISupportedTool } from '../../types/ISupportedTool';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { getSafe } from '../../util/storeHelper';

import {
  addDiscoveredTool, addNewTool,
  hideDiscoveredTool
} from '../gamemode_management/actions/settings';

import iconExtractor = require('icon-extractor');

import { log } from '../../util/log';

import { IToolDiscoveryResult } from '../gamemode_management/types/IStateEx';

import { Button } from '../../views/TooltipControls';

import * as fs from 'fs-extra-promise';

import ToolButton from './ToolButton';

import * as path from 'path';
import * as React from 'react';
import {
  ControlLabel, FormControl, HelpBlock,
  Jumbotron, Media, Modal, Well
} from 'react-bootstrap';
import Icon = require('react-fontawesome');

import { remote } from 'electron';

import update = require('react-addons-update');

interface IWelcomeScreenState {
  showLayer: string;
  showPage: string;
  executablePath: string;
  toolPath: string;
  commandLine: string;
  code64: string;
}

interface IActionProps {
  onAddDiscoveredTool: (gameId: string, toolId: string, result: IToolDiscoveryResult) => void;
  onRemoveDiscoveredTool: (gameId: string, toolId: string) => void;
  onAddNewTool: (gameId: string, toolId: string, newToolSettings: IToolDiscoveryResult) => void;
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
      toolPath: '',
      commandLine: '',
      code64: '',
    };
  }

  public componentWillMount() {

    iconExtractor.emitter.on('icon', (data) => {
      this.state.code64 = data.Base64ImageData;
    });

    this.setState(update(this.state, {
      showPage: { $set: null },
    }));
  }

  public render(): JSX.Element {
    let { t, gameMode } = this.props;

    return (
      <Jumbotron>
        {this.renderModalNewTool()}
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
    let { discoveredTools } = this.props;

    if (knownTools === null) {
      return null;
    }

    if (discoveredTools !== undefined) {
      for (let key of Object.keys(discoveredTools)) {
        if (key !== 'undefined') {
          let knownTool: ISupportedTool = knownTools.find((ele) => ele.id === key);
          if (knownTool === undefined) {
            let newSupportedTool: ISupportedTool = {
              logo: discoveredTools[key].logo !== undefined ? discoveredTools[key].logo : '',
              name: key, id: key, location: () => discoveredTools[key].path,
            };
            game.supportedTools.push(newSupportedTool);
          }
        }
      }
    }

    return (
      <div>
        {knownTools.map((tool) => this.renderSupportedTool(game, tool))}
      </div>
    );
  }

  private renderModalNewTool() {
    const { code64, commandLine, toolPath } = this.state;

    if (toolPath !== '') {
      iconExtractor.getIcon('Icon', toolPath);
    }

    return (
      <Modal show={this.state.showLayer === 'newTool'} onHide={this.hideLayer}>
        <Modal.Header>
          <Modal.Title>
            Adding New TOOL
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <ControlLabel>Tool Name</ControlLabel>
          <HelpBlock>{path.basename(toolPath.substr(0, toolPath.lastIndexOf('.')))}</HelpBlock>
          <ControlLabel>Tool Path</ControlLabel>
          <HelpBlock>{toolPath}</HelpBlock>
          <ControlLabel>Tool Icon</ControlLabel>
          <HelpBlock>{this.renderNewToolIcon(code64)}</HelpBlock>
          <ControlLabel>Command Line parameters</ControlLabel>
          <FormControl
            type='text'
            name='CommandLine'
            value={commandLine}
            placeholder='Command Line parameters'
            onChange={this.handleChangeCommandLine}
            />
          {this.renderSubmitButton()}
        </Modal.Body>
      </Modal>
    );
  }

  private handleChangeCommandLine = (event) => {
    this.handleChange(event, 'commandLine');
  }

  private handleChange(event, field) {
    this.setState(update(this.state, { [field]: { $set: event.target.value } }));
  }

  private newToolSubmit = (event) => {
    let {gameMode, knownGames, onAddNewTool} = this.props;
    const { code64, toolPath } = this.state;
    let game: IGame = knownGames.find((ele) => ele.id === gameMode);
    event.preventDefault();

    let newToolSettings: IToolDiscoveryResult = { path: null };
    let toolId: string;
    toolId = path.basename(toolPath.substr(0, toolPath.lastIndexOf('.')))

    let toolIconsPath: string = path.join(remote.app.getPath('userData'),
      'games', game.id);

    fs.ensureDirSync(toolIconsPath);
    fs.writeFile(path.join(toolIconsPath, toolId + '.png'), new Buffer(code64, 'base64'), (err) => {
      if (err) {
        log('info', 'error', { err });
        return;
      }
    });

    newToolSettings.hidden = false;
    newToolSettings.logo = toolIconsPath;
    newToolSettings.parameters = this.state.commandLine;
    newToolSettings.path = toolPath;
    onAddNewTool(game.id, toolId, newToolSettings);

    let newSupportedTool: ISupportedTool = {
      logo: newToolSettings.logo, name: toolId,
      id: toolId, location: () => toolPath
    };

    game.supportedTools.push(newSupportedTool);
  }

  private renderSubmitButton(): JSX.Element {
    return (
      <Button id='submit-newTool' type='submit' tooltip={'Submit'} onClick={this.newToolSubmit}>
        Submit
        </Button>);
  }

  private renderNewToolIcon(code64: string): JSX.Element {

    return (code64 !== undefined)
      ? <img
        src={'data:image/png;base64,' + code64}
        height='32'
        width='32'
        />
      : null;
  }

  private hideLayer = () => this.showLayerImpl('', '');

  private showNewToolLayer = (toolPath: string) => this.showLayerImpl('newTool', toolPath);

  private showLayerImpl(layer: string, toolPath: string): void {
    this.setState(update(this.state, { toolPath: { $set: toolPath } }));
    this.setState(update(this.state, { showLayer: { $set: layer } }));
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
        key={tool.id}
        game={game}
        tool={tool}
        discovery={toolDiscovery}
        onChangeToolLocation={this.props.onAddDiscoveredTool}
        onRemoveTool={this.props.onRemoveDiscoveredTool}
        onAddNewTool={this.showNewToolLayer}
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
    onAddNewTool: (gameId: string, toolId: string, newToolSettings: IToolDiscoveryResult) => {
      dispatch(addNewTool(gameId, toolId, newToolSettings));
    },
  };
}

export default
  translate(['common'], { wait: true })(
    connect(mapStateToProps, mapDispatchToProps)(WelcomeScreen)
  );
