import { showDialog } from '../../actions/notifications';
import Dropdown from '../../controls/Dropdown';
import Icon from '../../controls/Icon';
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

import {
  addDiscoveredTool,
  setToolVisible,
} from '../gamemode_management/actions/settings';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { IToolStored } from '../gamemode_management/types/IToolStored';
// TODO: this import is not ok because it breaks the encapsulation of the module
import GameThumbnail from '../gamemode_management/views/GameThumbnail';

import { setPrimaryTool } from './actions';

import ToolButton from './ToolButton';
import ToolEditDialogT from './ToolEditDialog';
let ToolEditDialog: typeof ToolEditDialogT = Placeholder;

import * as Promise from 'bluebird';
import * as update from 'immutability-helper';
import * as path from 'path';
import * as React from 'react';
import { Col, Grid, Media, MenuItem, Row } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import * as Redux from 'redux';
import { generate as shortid } from 'shortid';

interface IWelcomeScreenState {
  editTool: StarterInfo;
  counter: number;
  tools: StarterInfo[];
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

type IStarterProps = IConnectedProps & IActionProps;

class Starter extends ComponentEx<IStarterProps, IWelcomeScreenState> {
  private mIsMounted: boolean = false;
  private mRef: Element = null;
  constructor(props) {
    super(props);

    this.initState({
      editTool: undefined,
      counter: 1,
      tools: this.generateToolStarters(props),
    });
  }

  public componentDidMount() {
    this.mRef = ReactDOM.findDOMNode(this);
    this.mIsMounted = true;
    asyncRequire('./ToolEditDialog', __dirname)
      .then(moduleIn => {
        ToolEditDialog = moduleIn.default;
        if (this.mIsMounted) {
          this.forceUpdate();
        }
      });
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public componentWillReceiveProps(nextProps: IStarterProps) {
    if ((nextProps.discoveredGames !== this.props.discoveredGames)
       || (nextProps.discoveredTools !== this.props.discoveredTools)
       || (nextProps.gameMode !== this.props.gameMode)
       || (nextProps.knownGames !== this.props.knownGames)) {
      this.nextState.tools = this.generateToolStarters(nextProps);
   }
  }

  public render(): JSX.Element {
    const { discoveredGames, gameMode, knownGames } = this.props;

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
        <Media.Body>
          {this.renderToolIcons(game, discoveredGame)}
        </Media.Body>
      </Media>
    );
  }

  private renderToolIcons(game: IGameStored, discoveredGame: IDiscoveryResult): JSX.Element {
    const { discoveredTools, primaryTool } = this.props;
    const { tools } = this.state;

    if ((game === undefined) && (getSafe(discoveredGame, ['id'], undefined) === undefined)) {
      return null;
    }

    const gameId = discoveredGame.id || game.id;
    const knownTools: IToolStored[] = getSafe(game, ['supportedTools'], []);
    const preConfTools = new Set<string>(knownTools.map(tool => tool.id));

    const hidden = tools.filter(starter =>
      (discoveredTools[starter.id] !== undefined)
      && (discoveredTools[starter.id].hidden === true));

    const visible = tools.filter(starter =>
      starter.isGame
      || (discoveredTools[starter.id] === undefined)
      || (discoveredTools[starter.id].hidden !== true));

    visible.push(null);

    const split: StarterInfo[][] = visible.reduce((prev, value, idx) => {
      if ((idx % 4) === 0) {
        prev.push([]);
      }
      prev[Math.floor(idx / 4)].push(value);
      return prev;
    }, []);

    return (
      <div>
        <Grid fluid>
          <Row>{
            visible.map((col, colIdx) => (
              <Col key={colIdx} md={6} lg={4} >
                {col !== null ? this.renderTool(col) : this.renderAddButton(hidden)}
              </Col>
            ))
          }</Row>
        </Grid>
      </div>
    );
  }

  private renderTool = (starter: StarterInfo) => {
    const { t, primaryTool } = this.props;
    if (starter === undefined) {
      return null;
    }

    const isPrimary = (starter.id === primaryTool)
      || ((primaryTool === undefined) && starter.isGame);

    return (
      <ToolButton
        t={t}
        key={starter.id}
        primary={starter.id === primaryTool}
        starter={starter}
        onRun={this.startTool}
        onEdit={this.editTool}
        onRemove={this.removeTool}
        onMakePrimary={this.makePrimary}
      />
    );
  }

  private generateToolStarters(props: IStarterProps): StarterInfo[] {
    const { discoveredGames, discoveredTools, gameMode, knownGames } = props;

    const game: IGameStored = knownGames.find((ele) => ele.id === gameMode);
    const discoveredGame = discoveredGames[gameMode];

    if (game === undefined || discoveredGame === undefined) {
      return [];
    }

    const knownTools: IToolStored[] = getSafe(game, ['supportedTools'], []);
    const gameId = discoveredGame.id || game.id;
    const preConfTools = new Set<string>(knownTools.map(tool => tool.id));

    // add the main game executable
    const starters: StarterInfo[] = [
    ];

    try {
      starters.push(new StarterInfo(game, discoveredGame));
    } catch (err) {
      log('error', 'invalid game', { err });
    }

    // add the tools provided by the game extension (whether they are found or not)
    knownTools.forEach((tool: IToolStored) => {
      try {
        starters.push(new StarterInfo(game, discoveredGame, tool, discoveredTools[tool.id]));
      } catch (err) {
        log('warn', 'invalid tool', { err });
      }
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
      });

    return starters;
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
    .then(result => {
        return result.action === 'Run as administrator';
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

  private startTool = (info: StarterInfo) => {
    const startTool = require('../../util/startTool').default;
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
    const { t } = this.props;
    // <IconButton id='add-tool-icon' icon='plus' tooltip={t('Add Tool')} />
    return (
      <Dropdown
        id='add-tool-button'
        className='btn-add-tool'
        container={this.mRef}
      >
        <Dropdown.Toggle>
          <Icon name='plus' />
          <span className='btn-add-tool-text'>{t('Add Tool')}</span>
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {hidden.map(starter => (
            <MenuItem
              key={starter.id}
              eventKey={starter.id}
              onSelect={this.unhide}
            >{starter.name}
            </MenuItem>
          ))}
          <MenuItem
            key='__add'
            onSelect={this.addNewTool}
          >
            {t('New...')}
          </MenuItem>
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  private unhide = (toolId: any) => {
    const { gameMode, onSetToolVisible } = this.props;
    onSetToolVisible(gameMode, toolId, true);
  }

  private renderGameIcon = (game: IGameStored, discoveredGame: IDiscoveryResult): JSX.Element => {
    if ((game === undefined) && (discoveredGame === undefined)) {
      // assumption is that this can only happen during startup
      return <Icon name='spinner' pulse />;
    } else {
      const { t } = this.props;
      return (
        <GameThumbnail
          t={t}
          game={game}
          active={true}
          type='managed'
          onRefreshGameInfo={this.onRefreshGameInfo}
        />
      );
    }
  }

  private onRefreshGameInfo = (gameId: string) => {
    return new Promise<void>((resolve, reject) => {
      this.context.api.events.emit('refresh-game-info', gameId, (err: Error) => {
        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private renderEditToolDialog() {
    const { editTool } = this.state;
    if (editTool === undefined) {
      return null;
    }

    return (
      <ToolEditDialog
        tool={editTool}
        onClose={this.closeEditDialog}
      />
    );
  }

  private closeEditDialog = () => {
    // Through the counter, which is used in the key for the tool buttons
    // this also forces all tool buttons to be re-mounted to ensure the icon is
    // correctly updated
    this.nextState.editTool = undefined;
    this.nextState.counter = this.state.counter + 1;
  }

  private addNewTool = () => {
    const { gameMode, discoveredGames, knownGames } = this.props;

    const game: IGameStored = knownGames.find(ele => ele.id === gameMode);
    const empty = new StarterInfo(game, discoveredGames[gameMode], undefined, {
      id: shortid(),
      path: '',
      hidden: false,
      custom: true,
      workingDirectory: '',
      name: '',
      executable: undefined,
      requiredFiles: [],
      logo: undefined,
    });
    this.nextState.editTool = empty;
  }

  private editTool = (starter: StarterInfo) => {
    this.nextState.editTool = starter;
  }

  private removeTool = (starter: StarterInfo) => {
    this.props.onSetToolVisible(starter.gameId, starter.id, false);
  }

  private makePrimary = (starter: StarterInfo) => {
    this.props.onMakePrimary(starter.gameId, starter.isGame ? undefined : starter.id);
  }
}

function mapStateToProps(state: any): IConnectedProps {
  const gameMode: string = activeGameId(state);

  return {
    gameMode,
    knownGames: state.session.gameMode.known,
    discoveredGames: state.settings.gameMode.discovered,
    discoveredTools: getSafe(state, ['settings', 'gameMode',
      'discovered', gameMode, 'tools'], {}),
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
    onShowError: (message: string, details?: any) => showError(dispatch, message, details),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onMakePrimary: (gameId: string, toolId: string) => dispatch(setPrimaryTool(gameId, toolId)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(
  Starter) as React.ComponentClass<{}>;
