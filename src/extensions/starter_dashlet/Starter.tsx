import { showDialog } from '../../actions/notifications';
import Dashlet from '../../controls/Dashlet';
import Dropdown from '../../controls/Dropdown';
import EmptyPlaceholder from '../../controls/EmptyPlaceholder';
import Icon from '../../controls/Icon';
import Spinner from '../../controls/Spinner';
import { IconButton } from '../../controls/TooltipControls';
import { makeExeId } from '../../reducers/session';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../types/IDialog';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IRunningTool } from '../../types/IState';
import { ComponentEx, connect } from '../../util/ComponentEx';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import StarterInfo, { IStarterInfo } from '../../util/StarterInfo';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

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
let ToolEditDialog: typeof ToolEditDialogT;

import Promise from 'bluebird';
import { remote } from 'electron';
import * as React from 'react';
import { Media, MenuItem } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { generate as shortid } from 'shortid';

interface IWelcomeScreenState {
  editTool: StarterInfo;
  counter: number;
  tools: StarterInfo[];
  discovering: boolean;
}

interface IActionProps {
  onAddDiscoveredTool: (gameId: string, toolId: string, result: IDiscoveredTool) => void;
  onSetToolVisible: (gameId: string, toolId: string, visible: boolean) => void;
  onShowError: (message: string, details?: any, allowReport?: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onMakePrimary: (gameId: string, toolId: string) => void;
}

interface IConnectedProps {
  gameMode: string;
  knownGames: IGameStored[];
  discoveredGames: { [id: string]: IDiscoveryResult };
  discoveredTools: { [id: string]: IDiscoveredTool };
  primaryTool: string;
  toolsRunning: { [exePath: string]: IRunningTool };
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
      discovering: false,
    });
    this.updateJumpList(this.state.tools);
  }

  public componentDidMount() {
    this.mRef = ReactDOM.findDOMNode(this) as Element;
    this.mIsMounted = true;
    ToolEditDialog = require('./ToolEditDialog').default;
    if (this.mIsMounted) {
      this.forceUpdate();
    }
  }

  public componentWillUnmount() {
    this.mIsMounted = false;
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IStarterProps) {
    if ((nextProps.discoveredGames !== this.props.discoveredGames)
       || (nextProps.discoveredTools !== this.props.discoveredTools)
       || (nextProps.gameMode !== this.props.gameMode)
       || (nextProps.knownGames !== this.props.knownGames)) {
      this.nextState.tools = this.generateToolStarters(nextProps);

      this.updateJumpList(this.nextState.tools);
   }
  }

  public render(): JSX.Element {
    const { t, discoveredGames, gameMode, knownGames } = this.props;

    let content: JSX.Element;

    if (gameMode === undefined) {
      content = (
        <EmptyPlaceholder
          icon='game'
          text={t('When you are managing a game, supported tools will appear here')}
          fill
        />
      );
    } else {
      const game: IGameStored = knownGames.find((ele) => ele.id === gameMode);
      const discoveredGame = discoveredGames[gameMode];
      content = (
        <Media id='starter-dashlet'>
          <Media.Left>
            {this.renderGameIcon(game, discoveredGame)}
            {this.renderEditToolDialog()}
          </Media.Left>
          <Media.Body>
            {this.renderToolIcons(game, discoveredGame)}
          </Media.Body>
          <Media.Right>
            {this.renderAddButton()}
            {this.renderRefresh()}
          </Media.Right>
        </Media>
      );
    }

    return (
      <Dashlet title='' className='dashlet-starter'>
        {content}
      </Dashlet>
    );
  }

  private renderRefresh() {
    const { t } = this.props;
    const { discovering } = this.state;
    return (
      <IconButton
        icon={discovering ? 'spinner' : 'refresh'}
        tooltip={t('Quickscan')}
        onClick={this.quickDiscovery}
        className='refresh-button'
      />
    );
  }

  private renderToolIcons(game: IGameStored, discoveredGame: IDiscoveryResult): JSX.Element {
    const { discoveredTools } = this.props;
    const { tools } = this.state;

    if ((game === undefined) && (getSafe(discoveredGame, ['id'], undefined) === undefined)) {
      return null;
    }

    const visible = tools.filter(starter =>
      starter.isGame
      || (discoveredTools[starter.id] === undefined)
      || (discoveredTools[starter.id].hidden !== true));

    return (
      <div className='tool-icon-box'>
        {visible.map((vis, idx) => <div key={idx}>{this.renderTool(vis)}</div>)}
      </div>
    );
  }

  private renderAddButton() {
    const { t, discoveredTools } = this.props;
    const { tools } = this.state;

    const hidden = tools.filter(starter =>
      (discoveredTools[starter.id] !== undefined)
      && (discoveredTools[starter.id].hidden === true));

    return (
      <Dropdown
        id='add-tool-button'
        className='btn-add-tool'
        // container={this.mRef}
      >
        <Dropdown.Toggle>
          <Icon name='add' />
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

  private renderGameIcon = (game: IGameStored, discoveredGame: IDiscoveryResult): JSX.Element => {
    if ((game === undefined) && (discoveredGame === undefined)) {
      // assumption is that this can only happen during startup
      return <Spinner />;
    } else {
      const { t } = this.props;
      return (
        <GameThumbnail
          t={t}
          game={game}
          active={true}
          type='launcher'
          onRefreshGameInfo={this.onRefreshGameInfo}
          onLaunch={this.startGame}
        />
      );
    }
  }

  private renderTool = (starter: StarterInfo) => {
    const { t, primaryTool, toolsRunning } = this.props;
    const { counter } = this.state;
    if (starter === undefined) {
      return null;
    }

    const running = (starter.exePath !== undefined)
                 && (toolsRunning[makeExeId(starter.exePath)] !== undefined);

    return (
      <ToolButton
        t={t}
        key={starter.id}
        primary={starter.id === primaryTool}
        counter={counter}
        starter={starter}
        running={running}
        onRun={this.startTool}
        onEdit={this.editTool}
        onRemove={this.removeTool}
        onMakePrimary={this.makePrimary}
      />
    );
  }

  private quickDiscovery = () => {
    const { gameMode } = this.props;
    this.nextState.discovering = true;
    const start = Date.now();
    this.context.api.emitAndAwait('discover-tools', gameMode)
      .then(() => {
        setTimeout(() => {
          this.nextState.discovering = false;
        }, 1000 - (Date.now() - start));
      });
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
      .sort((lhs, rhs) => {
        const tlhs = discoveredTools[lhs]?.timestamp || 0;
        const trhs = discoveredTools[rhs]?.timestamp || 0;
        return tlhs - trhs;
      })
      .forEach(toolId => {
        try {
          starters.push(new StarterInfo(game, discoveredGame, undefined, discoveredTools[toolId]));
        } catch (err) {
          log('error', 'tool configuration invalid', { gameId, toolId, error: err.message });
        }
      });

    return starters;
  }

  private updateJumpList(starters: IStarterInfo[]) {
    if (process.platform !== 'win32') {
      return;
    }
    const userTasks: Electron.Task[] = starters
      .filter(starter =>
        (truthy(starter.exePath))
        && (Object.keys(starter.environment || {}).length === 0))
      .map(starter => {
        const task: Electron.Task = {
          arguments: starter.commandLine.join(' '),
          description: starter.name,
          iconIndex: 0,
          iconPath: StarterInfo.getIconPath(starter),
          program: starter.exePath,
          title: starter.name,
          workingDirectory: starter.workingDirectory,
        };
        return task;
      });
    remote.app.setUserTasks(userTasks);
  }

  private startGame = () => {
    const { primaryTool } = this.props;
    const { tools } = this.state;

    if (!truthy(primaryTool)) {
      this.startTool(tools[0]);
    } else {
      const info = tools.find(iter => iter.id === primaryTool);
      this.startTool(info || tools[0]);
    }
  }

  private startTool = (info: StarterInfo) => {
    const { onShowError } = this.props;
    if (info?.exePath === undefined) {
      onShowError('Tool missing/misconfigured',
        'Please ensure that the tool/game is configured correctly and try again', false);
      return;
    }
    StarterInfo.run(info, this.context.api, onShowError);
  }

  private unhide = (toolId: any) => {
    const { gameMode, onSetToolVisible } = this.props;
    onSetToolVisible(gameMode, toolId, true);
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
      shell: false,
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
    this.props.onMakePrimary(starter.gameId, starter.isGame ? null : starter.id);
  }
}

const emptyObj = {};

function mapStateToProps(state: any): IConnectedProps {
  const gameMode: string = activeGameId(state);

  return {
    gameMode,
    knownGames: state.session.gameMode.known,
    discoveredGames: state.settings.gameMode.discovered,
    discoveredTools: getSafe(state, ['settings', 'gameMode',
      'discovered', gameMode, 'tools'], emptyObj),
    primaryTool: getSafe(state, ['settings', 'interface', 'primaryTool', gameMode], undefined),
    toolsRunning: state.session.base.toolsRunning,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onAddDiscoveredTool: (gameId: string, toolId: string, result: IDiscoveredTool) => {
      dispatch(addDiscoveredTool(gameId, toolId, result, true));
    },
    onSetToolVisible: (gameId: string, toolId: string, visible: boolean) => {
      dispatch(setToolVisible(gameId, toolId, visible));
    },
    onShowError: (message: string, details?: any, allowReport?: boolean) =>
      showError(dispatch, message, details, { allowReport }),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onMakePrimary: (gameId: string, toolId: string) => dispatch(setPrimaryTool(gameId, toolId)),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(Starter);
