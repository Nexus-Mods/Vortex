import { showDialog } from '../../actions/notifications';
import Dashlet from '../../controls/Dashlet';
import EmptyPlaceholder from '../../controls/EmptyPlaceholder';
import { makeExeId } from '../../reducers/session';
import { DialogActions, DialogType, IDialogContent, IDialogResult } from '../../types/IDialog';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IMod, IRunningTool } from '../../types/IState';
import { ComponentEx, connect } from '../../util/ComponentEx';
import lazyRequire from '../../util/lazyRequire';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import { activeGameId } from '../../util/selectors';
import StarterInfo, { IStarterInfo } from '../../util/StarterInfo';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import Debouncer from '../../util/Debouncer';

import { BoxWithHandle } from './BoxWithHandle';

import AddToolButton from './AddToolButton';

import {
  addDiscoveredTool,
  setToolVisible,
} from '../gamemode_management/actions/settings';

import { IDiscoveryResult } from '../gamemode_management/types/IDiscoveryResult';
import { IGameStored } from '../gamemode_management/types/IGameStored';
import { IToolStored } from '../gamemode_management/types/IToolStored';

import { setPrimaryTool, setToolOrder } from './actions';

import ToolButton from './ToolButton';
import ToolEditDialogT from './ToolEditDialog';
let ToolEditDialog: typeof ToolEditDialogT;

import * as remoteT from '@electron/remote';
import Promise from 'bluebird';
import * as React from 'react';
import { Media } from 'react-bootstrap';
import * as ReactDOM from 'react-dom';
import * as Redux from 'redux';
import { ThunkDispatch } from 'redux-thunk';
import { generate as shortid } from 'shortid';

import DynDiv from '../../controls/DynDiv';
import FlexLayout from '../../controls/FlexLayout';

const remote: typeof remoteT = lazyRequire(() => require('@electron/remote'));

interface IBaseProps {
  onGetValidTools: (starters: IStarterInfo[], gameMode: string) => Promise<string[]>;
}

interface IConnectedProps {
  addToTitleBar: boolean;
  toolsOrder: string[];
  gameMode: string;
  knownGames: IGameStored[];
  discoveredGames: { [id: string]: IDiscoveryResult };
  discoveredTools: { [id: string]: IDiscoveredTool };
  primaryTool: string;
  toolsRunning: { [exePath: string]: IRunningTool };
  mods: { [modId: string]: IMod };
}

interface IWelcomeScreenState {
  editTool: StarterInfo;
  counter: number;
  gameStarter: StarterInfo;
  tools: StarterInfo[];
  validToolIds: string[];
  discovering: boolean;
}

interface IActionProps {
  onAddDiscoveredTool: (gameId: string, toolId: string, result: IDiscoveredTool) => void;
  onSetToolVisible: (gameId: string, toolId: string, visible: boolean) => void;
  onShowError: (message: string, details?: any, allowReport?: boolean) => void;
  onShowDialog: (type: DialogType, title: string, content: IDialogContent,
                 actions: DialogActions) => Promise<IDialogResult>;
  onSetPrimary: (gameId: string, toolId: string) => void;
  onSetToolOrder: (gameId: string, tools: string[]) => void;
}

type IStarterProps = IBaseProps & IConnectedProps & IActionProps;

class Starter extends ComponentEx<IStarterProps, IWelcomeScreenState> {
  private mMoveDebouncer: Debouncer;
  private mIsMounted: boolean = false;
  private mRef: Element = null;
  constructor(props) {
    super(props);

    this.initState({
      validToolIds: [],
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
    this.mMoveDebouncer = new Debouncer((srcId: string, destId: string) => {
      this.moveItem(srcId, destId);
      return null;
    }, 200, false);
  }

  public componentDidMount() {
    this.mRef = ReactDOM.findDOMNode(this) as Element;
    this.mIsMounted = true;
    ToolEditDialog = require('./ToolEditDialog').default;
    if (this.mIsMounted) {
      this.updateValidTools(this.state.tools);
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
       || (nextProps.toolsOrder !== this.props.toolsOrder)
       // You'll have to thank whoever thought it's a good idea to install tools
       //  as mods for the one below!
       || (nextProps.mods !== this.props.mods)) {
      this.nextState.gameStarter = this.generateGameStarter(nextProps);
      this.nextState.tools = this.generateToolStarters(nextProps);
      this.updateValidTools(this.nextState.tools);
      const tools = truthy(this.nextState.gameStarter)
        ? [this.nextState.gameStarter].concat(this.nextState.tools)
        : this.nextState.tools;
      if (nextProps.toolsOrder.length === 0 && this.nextState.tools.length > 0) {
        this.applyOrder(this.nextState.tools.map(tool => tool.id));
      }
      this.updateJumpList(tools);
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
          <FlexLayout type='row' className='starter-dashlet-tools-header'>
            <div className='dashlet-title'>{t('Tools')}</div>
            <DynDiv group='starter-dashlet-tools-controls' />
          </FlexLayout>
          <Media.Body>
            <FlexLayout type='column'>
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
          onSetToolOrder={this.applyOrder}
          onAddNewTool={this.addNewTool}
          tools={tools}
        />
      </div>
    );
  }

  private updateValidTools = (tools: IStarterInfo[]) => {
    this.props.onGetValidTools(tools, this.props.gameMode)
      .then((valid) => {
        this.nextState.validToolIds = valid
      });
  }

  private moveItemDebounce = (srcId: string, destId: string) => {
    this.mMoveDebouncer.schedule(undefined, srcId, destId);
  }

  private renderTool = (starter: StarterInfo, idx: number) => {
    const { t, toolsRunning, primaryTool } = this.props;
    const { counter, validToolIds } = this.state;
    const running = (starter.exePath !== undefined)
                 && (toolsRunning[makeExeId(starter.exePath)] !== undefined);
    return (
      <BoxWithHandle
        index={idx}
        key={starter.id}
        item={starter}
        onMoveItem={this.moveItemDebounce}
        {...this.props}
      >
        <ToolButton
          t={t}
          valid={validToolIds.includes(starter.id)}
          primary={starter.id === primaryTool}
          counter={counter}
          item={starter}
          running={running}
          onRun={this.startTool}
          onEdit={this.editTool}
          onMoveItem={this.moveItemDebounce}
          onRemove={this.removeTool}
          onMakePrimary={this.setPrimary}
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
    const names = ordered.map(id => {
      const tool = this.state.tools.find(tool => tool.id === id);
      return tool?.name;
    }).filter(name => !!name);
    this.context.api.events.emit('analytics-track-event', 'Tools', 'Drag above/below', 'Rearranged tools', names.join());
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

  private generateToolStarters = (props: IStarterProps): StarterInfo[] => {
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
      .filter(toolId => !preConfTools.has(toolId) && (toolId !== this.state?.gameStarter?.id))
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

    const findIdx = (starter: StarterInfo) => {
      const idx = toolsOrder.findIndex(toolId => toolId === starter.id);
      return idx !== -1 ? idx : starters.length;
    };
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

  private startTool = (info: StarterInfo) => {
    const { onShowError } = this.props;
    if (info?.exePath === undefined) {
      onShowError('Tool missing/misconfigured',
        'Please ensure that the tool/game is configured correctly and try again', false);
      return;
    }
    this.context.api.events.emit('analytics-track-click-event', 'Tools', 'Manually ran tool');
    StarterInfo.run(info, this.context.api, onShowError);
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

    this.context.api.events.emit('analytics-track-click-event', 'Tools', 'Add tool');
  }

  private editTool = (starter: StarterInfo) => {
    this.nextState.editTool = starter;
  }

  private removeTool = (starter: StarterInfo) => {
    this.context.api.events.emit('analytics-track-click-event', 'Tools', 'Removed tool');
    this.props.onSetToolVisible(starter.gameId, starter.id, false);
  }

  private setPrimary = (starter: StarterInfo) => {
    if (starter.id === this.props.primaryTool) {
      this.props.onSetPrimary(starter.gameId, null);
    } else {
      this.context.api.events.emit('analytics-track-click-event', 'Tools', 'Selected new primary tool');
      this.props.onSetPrimary(starter.gameId, starter.isGame ? null : starter.id);
    }
  }
}

const emptyObj = {};
function mapStateToProps(state: any): IConnectedProps {
  const gameMode: string = activeGameId(state);

  return {
    gameMode,
    addToTitleBar: getSafe(state,
      ['settings', 'interface', 'tools', 'addToolsToTitleBar'], false),
    toolsOrder: getSafe(state,
      ['settings', 'interface', 'tools', 'order', gameMode], []),
    knownGames: state.session.gameMode.known,
    discoveredGames: state.settings.gameMode.discovered,
    discoveredTools: getSafe(state, ['settings', 'gameMode',
      'discovered', gameMode, 'tools'], emptyObj),
    primaryTool: getSafe(state, ['settings', 'interface', 'primaryTool', gameMode], undefined),
    toolsRunning: state.session.base.toolsRunning,
    mods: getSafe(state, ['persistent', 'mods', gameMode], emptyObj),
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
    onSetPrimary: (gameId: string, toolId: string) => dispatch(setPrimaryTool(gameId, toolId)),
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
