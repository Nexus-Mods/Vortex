import { showDialog } from '../../actions/notifications';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../types/IDialog';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { ComponentEx, connect, translate } from '../../util/ComponentEx';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import Icon from '../../views/Icon';
import { Button } from '../../views/TooltipControls';

import { addDiscoveredTool, changeToolParams,
         removeDiscoveredTool } from '../gamemode_management/actions/settings';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { IToolStored } from '../gamemode_management/types/IToolStored';

import runToolElevated from './runToolElevated';
import ToolButton from './ToolButton';
import ToolEditDialog from './ToolEditDialog';

import * as Promise from 'bluebird';
import { execFile } from 'child_process';
import * as path from 'path';
import * as React from 'react';
import { Media } from 'react-bootstrap';
import update = require('react-addons-update');
import { generate as shortid } from 'shortid';

interface IWelcomeScreenState {
  editTool: string;
  counter: number;
}

interface IActionProps {
  onAddDiscoveredTool: (gameId: string, toolId: string, result: IDiscoveredTool) => void;
  onRemoveDiscoveredTool: (gameId: string, toolId: string) => void;
  onChangeToolParams: (toolId: string) => void;
  onShowError: (message: string, details?: string | Error) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
}

interface IConnectedProps {
  gameMode: string;
  knownGames: IGameStored[];
  discoveredGames: { [id: string]: IDiscoveryResult };
  discoveredTools: { [id: string]: IDiscoveredTool };
  autoDeploy: boolean;
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

  public render(): JSX.Element {
    let { t, gameMode, knownGames } = this.props;

    if (gameMode === undefined) {
      return null;
    }

    let game: IGameStored = knownGames.find((ele) => ele.id === gameMode);

    return (
      <Media>
        <Media.Left>
          {this.renderGameIcon(game)}
          {this.renderEditToolDialog()}
        </Media.Left>
        <Media.Right>
          <Media.Heading>
            {game === undefined ? gameMode : game.name}
          </Media.Heading>
          <Button
            id='start-game-btn'
            tooltip={t('Start Game')}
            onClick={this.startGame}
          >
            <Icon name='play' className='game-start-btn' />
          </Button>
          <h5>
            {t('Tools:')}
          </h5>
          {game === undefined ? null : this.renderSupportedToolsIcons(game)}
        </Media.Right>
      </Media>
    );
  }

  private startGame = () => {
    this.startDeploy()
    .then((doStart: boolean) => {
      const {discoveredGames, gameMode} = this.props;
      if (doStart) {
        const game = this.currentGame();
        const discovery = discoveredGames[gameMode];

        execFile(path.join(discovery.path, game.executable));
      }
    })
    .catch((err: Error) => {
      this.props.onShowError('Failed to activate', err);
    })
    ;
  }

 private runTool = (toolId: string) => {
    this.startDeploy()
      .then((doStart: boolean) => {
        if (!doStart) {
          return;
        }
        const { discoveredTools, onShowError } = this.props;

        let discoveredTool = discoveredTools[toolId];
        try {
          let execOptions = {
            cwd: discoveredTool.currentWorkingDirectory !== undefined ?
              discoveredTool.currentWorkingDirectory : path.dirname(discoveredTool.path),
          };

          execFile(discoveredTool.path, discoveredTool.parameters, execOptions, (err, output) => {
            if (err) {
              log('error', 'failed to spawn', { err, path: discoveredTool.path });
            }
          });
        } catch (err) {
          if (err.errno === 'UNKNOWN') {
            const { dialog } = require('electron').remote;
            dialog.showMessageBox({
              buttons: ['Ok', 'Cancel'],
              title: 'Missing elevation',
              message: discoveredTool.name + ' cannot be started because it requires elevation. ' +
              'Would you like to run the tool elevated?',
            }, (buttonIndex) => {
              if (buttonIndex === 0) {
                runToolElevated(discoveredTool, onShowError);
              }
            });
          } else {
            log('info', 'failed to run custom tool', { err: err.message });
          }
        }
    });
  }

  private startDeploy(): Promise<boolean> {
    const { autoDeploy, onShowDialog } = this.props;
    if (!autoDeploy) {
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
          case 'Skip': return Promise.resolve(true);
          case 'Deploy': return new Promise<boolean>((resolve, reject) => {
            this.context.api.events.emit('activate-mods', (err) => {
              if (err !== null) {
                reject(err);
              } else {
                resolve(true);
              }
            });
          });
          default: return Promise.resolve(false);
        }
      });
    } else {
      return new Promise<boolean>((resolve, reject) => {
        this.context.api.events.emit('await-activation', (err: Error) => {
          if (err !== null) {
            reject(err);
          } else {
            resolve(true);
          }
        });
      });
    }
  }

  private renderGameIcon = (game: IGameStored): JSX.Element => {
    if (game === undefined) {
      // assumption is that this can only happen during startup
      return <Icon name='spinner' pulse />;
    } else {
      let logoPath = path.join(game.pluginPath, game.logo);
      return <img className='welcome-game-logo' src={logoPath} />;
    }
  }

  private renderSupportedToolsIcons = (game: IGameStored): JSX.Element => {
    let knownTools: IToolStored[] = game.supportedTools;
    let { discoveredTools } = this.props;

    if (knownTools === null) {
      return null;
    }

    let tools: IDiscoveredTool[] = this.mergeTools(knownTools, discoveredTools);

    return (
      <div>
        {tools.map((tool) => this.renderSupportedTool(game, tool))}
      </div>
    );
  }

  private mergeTools(knownTools: IToolStored[],
                     discoveredTools: { [id: string]: IDiscoveredTool }): IDiscoveredTool[] {
    let result: IDiscoveredTool[] = knownTools.map((tool: IToolStored): IDiscoveredTool => {
      return Object.assign({}, tool, {
        executable: () => tool.executable,
        path: '',
        hidden: false,
        parameters: [],
        custom: false,
        currentWorkingDirectory: '',
        requiredFiles: [],
      });
    });

    let lookup = result.reduce((prev: Object, current: IDiscoveredTool, idx: number) => {
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

    return result.filter((tool: IDiscoveredTool) => tool !== undefined ? !tool.hidden : null);
  }

  private currentGame(): IGameStored {
    const { gameMode, knownGames } = this.props;
    return knownGames.find((ele) => ele.id === gameMode);
  }

  private renderEditToolDialog() {
    const toolId = this.state.editTool;
    if (toolId === undefined) {
      return null;
    }

    const { discoveredTools } = this.props;
    const game = this.currentGame();
    let tool: IDiscoveredTool = {
      hidden: false,
      id: toolId,
      custom: false,
      name: '',
      path: '',
      parameters: [],
      currentWorkingDirectory: '',
      requiredFiles: [],
      executable: () => '',
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

  private renderSupportedTool = (game: IGameStored,
                                 tool: IToolStored | IDiscoveredTool): JSX.Element => {
    let { t, onAddDiscoveredTool, onRemoveDiscoveredTool, onShowError } = this.props;

    let key = `${tool.id}_${this.state.counter}`;

    return (
      <ToolButton
        t={t}
        key={key}
        game={game}
        toolId={tool.id}
        tool={tool}
        onRunTool={this.runTool}
        onChangeToolLocation={onAddDiscoveredTool}
        onRemoveTool={onRemoveDiscoveredTool}
        onAddNewTool={this.addNewTool}
        onChangeToolParams={this.editTool}
        onShowError={onShowError}
      />
    );
  }

  private addNewTool = () => {
    this.setState(update(this.state, {
      editTool: { $set: shortid() },
    }));
  }

  private editTool = (toolId: string) => {
    this.setState(update(this.state, {
      editTool: { $set: toolId },
    }));
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
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch<any>): IActionProps {
  return {
    onAddDiscoveredTool: (gameId: string, toolId: string, result: IDiscoveredTool) => {
      dispatch(addDiscoveredTool(gameId, toolId, result));
    },
    onRemoveDiscoveredTool: (gameId: string, toolId: string) => {
      dispatch(removeDiscoveredTool(gameId, toolId));
    },
    onChangeToolParams: (toolId: string) => {
      dispatch(changeToolParams(toolId));
    },
    onShowError: (message: string, details?: string | Error) =>
      showError(dispatch, message, details),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
  };
}

export default
  translate(['common'], {
    wait: true,
    bindI18n: 'languageChanged loaded',
    bindStore: false,
  } as any)(
    connect(mapStateToProps, mapDispatchToProps)(Starter)
 );
