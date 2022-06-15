import { showDialog } from '../../actions/notifications';
import Dashlet from '../../controls/Dashlet';
import Dropdown from '../../controls/Dropdown';
import EmptyPlaceholder from '../../controls/EmptyPlaceholder';
import Icon from '../../controls/Icon';
import Spinner from '../../controls/Spinner';
import DraggableListWrapper from '../../controls/DraggableList';
import { IconButton } from '../../controls/TooltipControls';
import { makeExeId } from '../../reducers/session';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../types/IDialog';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IRunningTool } from '../../types/IState';
import { ComponentEx, connect } from '../../util/ComponentEx';
import lazyRequire from '../../util/lazyRequire';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import StarterInfo, { IStarterInfo } from '../../util/StarterInfo';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import { BoxWithHandle } from './BoxWithHandle';

import AddToolButton from './AddToolButton';

import {
  addDiscoveredTool,
  setToolVisible,
} from '../gamemode_management/actions/settings';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { IToolStored } from '../gamemode_management/types/IToolStored';
// TODO: this import is not ok because it breaks the encapsulation of the module
import GameThumbnail from '../gamemode_management/views/GameThumbnail';

import { setAddToTitleBar, setPrimaryTool, setToolOrder } from './actions';

import ToolButton from './ToolButton';
import ToolEditDialogT from './ToolEditDialog';
let ToolEditDialog: typeof ToolEditDialogT;

import * as remoteT from '@electron/remote';
import Promise from 'bluebird';
import * as React from 'react';
import { ListGroupItem, Media, MenuItem } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { generate as shortid } from 'shortid';

import { IConnectedProps, IDraggableListItemProps } from './types';

import FlexLayout from '../../controls/FlexLayout';
import Toggle from '../../controls/Toggle';

const remote: typeof remoteT = lazyRequire(() => require('@electron/remote'));

interface IWelcomeScreenState {
  editTool: StarterInfo;
  counter: number;
  gameStarter: StarterInfo;
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
  onAddToTitleBar: (gameId: string, addToTitleBar: boolean) => void;
  onSetToolOrder: (gameId: string, tools: string[]) => void;
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
      gameStarter: this.generateGameStarter(props),
      tools: this.generateToolStarters(props),
      discovering: false,
    });
    const tools = truthy(this.state.gameStarter)
      ? [this.state.gameStarter].concat(this.state.tools)
      : this.state.tools;
    this.updateJumpList(tools);
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
       || (nextProps.knownGames !== this.props.knownGames)
       || (nextProps.toolsOrder !== this.props.toolsOrder)) {
      this.nextState.gameStarter = this.generateGameStarter(nextProps);
      this.nextState.tools = this.generateToolStarters(nextProps);
      const tools = truthy(this.nextState.gameStarter)
        ? [this.nextState.gameStarter].concat(this.nextState.tools)
        : this.nextState.tools;
      this.updateJumpList(tools);
   }
  }

  public render(): JSX.Element {
    const { addToTitleBar, t, discoveredGames, gameMode, knownGames, onAddToTitleBar } = this.props;

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
          <Media.Body>
            <FlexLayout type='column'>
              <FlexLayout type='row' className='starter-dashlet-tools-header'>
                <h1>{t('Tools')}</h1>
                <Toggle
                  checked={addToTitleBar}
                  onToggle={this.onToggle}
                >
                  {t('Add to Titlebar')}
                </Toggle>
              </FlexLayout>
              {this.renderEditToolDialog()}
              {this.renderToolIcons(game, discoveredGame)}
            </FlexLayout>
          </Media.Body>
        </Media>
      );
    }

    return (
      <Dashlet title='' className='dashlet-starter'>
        {content}
      </Dashlet>
    );
  }

  private onToggle = (value: boolean) => {
    this.props.onAddToTitleBar(this.props.gameMode, value);
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
        {visible.map(this.renderTool)}
        <AddToolButton
          onAddNewTool={this.addNewTool}
          tools={visible}
        />
      </div>
    );
  }

  private renderTool = (starter: StarterInfo) => {
    const { t, toolsRunning, primaryTool } = this.props;
    const { counter, tools } = this.state;
    const running = (starter.exePath !== undefined)
                 && (toolsRunning[makeExeId(starter.exePath)] !== undefined);
    return (
      <BoxWithHandle
        key={starter.id}
        item={starter}
        {...this.props}
      >
        <ToolButton
          t={t}
          primary={starter.id === primaryTool}
          counter={counter}
          item={starter}
          running={running}
          onRun={this.startTool}
          onEdit={this.editTool}
          onMoveItem={this.moveItem}
          onRemove={this.removeTool}
          onMakePrimary={this.makePrimary}
        />
      </BoxWithHandle>);
  }

  private moveItem = (srcId: string, destId: string) => {
    const { tools } = this.state;
    const sourceIndex = tools.findIndex(item => item.id === srcId);
    const destinationIndex = tools.findIndex(item => item.id === destId);
    if (sourceIndex === -1 || destinationIndex === -1) {
      return;
    }

    const offset = destinationIndex - sourceIndex;
    const newOrder = moveElement(tools, sourceIndex, offset);
    this.applyOrder(newOrder.map(starter => starter.id));
  }

  private applyOrder = (ordered: string[]) => {
    this.props.onSetToolOrder(this.props.gameMode, ordered);
  }

  private generateGameStarter(props: IStarterProps): StarterInfo {
    const { discoveredGames, gameMode, knownGames } = props;

    const game: IGameStored = knownGames.find((ele) => ele.id === gameMode);
    const discoveredGame: IDiscoveryResult = discoveredGames[gameMode];

    if (game === undefined || discoveredGame?.path === undefined) {
      return null;
    }
    try {
      const starter = new StarterInfo(game, discoveredGame);
      return starter;
    } catch (err) {
      log('error', 'invalid game', { err });
    }
    return null;
  }

  private generateToolStarters(props: IStarterProps): StarterInfo[] {
    const { discoveredGames, discoveredTools, gameMode, knownGames, toolsOrder } = props;

    const game: IGameStored = knownGames.find((ele) => ele.id === gameMode);
    const discoveredGame: IDiscoveryResult = discoveredGames[gameMode];

    if (game === undefined || discoveredGame?.path === undefined) {
      return [];
    }

    const knownTools: IToolStored[] = getSafe(game, ['supportedTools'], []);
    const gameId = discoveredGame.id || game.id;
    const preConfTools = new Set<string>(knownTools.map(tool => tool.id));

    const starters: StarterInfo[] = [
    ];

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

    const findIdx = (starter: StarterInfo) => toolsOrder.findIndex(toolId => toolId === starter.id);
    starters.sort((lhs, rhs) => findIdx(lhs) - findIdx(rhs));
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
    const { tools, gameStarter } = this.state;

    if (!truthy(primaryTool)) {
      this.startTool(gameStarter);
    } else {
      const info = tools.find(iter => iter.id === primaryTool);
      this.startTool(info || gameStarter);
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

    this.context.api.events.emit('analytics-track-click-event', 'Dashboard', 'Add tool');
  }

  private editTool = (starter: StarterInfo) => {
    this.nextState.editTool = starter;
  }

  private removeTool = (starter: StarterInfo) => {
    this.props.onSetToolVisible(starter.gameId, starter.id, false);
  }

  private makePrimary = (starter: StarterInfo) => {
    if (starter.id === this.props.primaryTool) {
      this.props.onMakePrimary(starter.gameId, null);
    } else {
      this.props.onMakePrimary(starter.gameId, starter.isGame ? null : starter.id);
    }
  }
}

const emptyObj = {};
function mapStateToProps(state: any): IConnectedProps {
  const gameMode: string = activeGameId(state);

  return {
    gameMode,
    addToTitleBar: getSafe(state,
      ['settings', 'interface', 'tools', 'addToolsToTitleBar', gameMode], false),
    toolsOrder: getSafe(state,
      ['settings', 'interface', 'tools', 'order', gameMode], []),
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
    onAddToTitleBar: (gameId: string, addToTitleBar: boolean) =>
      dispatch(setAddToTitleBar(gameId, addToTitleBar)),
    onSetToolOrder: (gameId: string, order: string[]) => dispatch(setToolOrder(gameId, order)),
  };
}

function move(array, oldIndex, newIndex) {
  if (newIndex >= array.length) {
    newIndex = array.length - 1;
  }
  const newArray = [...array];
  newArray.splice(newIndex, 0, newArray.splice(oldIndex, 1)[0]);
  return newArray;
}

function moveElement(array, index, offset) {
  const newIndex = index + offset;
  return move(array, index, newIndex);
}

export default connect(mapStateToProps, mapDispatchToProps)(Starter);
