import type PromiseBB from "bluebird";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import {
  getErrorMessageOrDefault,
  unknownToError,
} from "@vortex/shared";
import * as React from "react";
import { Media } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { generate as shortid } from "shortid";

import type {
  DialogActions,
  DialogType,
  IDialogContent,
  IDialogResult,
} from "../../types/IDialog";
import type { IDiscoveredTool } from "../../types/IDiscoveredTool";
import type { IMod, IRunningTool } from "../../types/IState";
import type { IStarterInfo } from "../../util/StarterInfo";
import type { IDiscoveryResult } from "../gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "../gamemode_management/types/IGameStored";
import type { IToolStored } from "../gamemode_management/types/IToolStored";
import type { IReducerAction, StateReducerType } from "./types";

import { showDialog } from "../../actions/notifications";
import Dashlet from "../../controls/Dashlet";
import DynDiv from "../../controls/DynDiv";
import EmptyPlaceholder from "../../controls/EmptyPlaceholder";
import FlexLayout from "../../controls/FlexLayout";
import { log } from "../../util/log";
import { showError } from "../../util/message";
import { activeGameId } from "../../util/selectors";
import StarterInfo from "../../util/StarterInfo";
import { getSafe } from "../../util/storeHelper";
import { truthy } from "../../util/util";
import { MainContext } from "../../views/MainWindow";
import {
  addDiscoveredTool,
  setToolVisible,
} from "../gamemode_management/actions/settings";
import { setPrimaryTool, setToolOrder } from "./actions";
import AddToolButton from "./AddToolButton";
import Tool from "./Tool";
import ToolEditDialog from "./ToolEditDialog";
import { propOf, updateJumpList } from "./util";

interface IBaseProps {
  onGetValidTools: (
    starters: IStarterInfo[],
    gameMode: string,
  ) => PromiseBB<string[]>;
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
  deploymentCounter: number;
}

interface IWelcomeScreenState {
  editTool: StarterInfo;
  counter: number;
  gameStarter: StarterInfo;
  tools: IStarterInfo[];
  validToolIds: string[];
  discovering: boolean;
}

const initialState: IWelcomeScreenState = {
  validToolIds: [],
  editTool: undefined,
  counter: 1,
  gameStarter: undefined,
  tools: [],
  discovering: false,
};

const welcomeScreenStateReducer = (
  state: IWelcomeScreenState,
  actions: IReducerAction<any>[],
) => {
  const newState = { ...state };
  for (const action of actions) {
    newState[action.type] = action.value;
  }
  return newState;
};

interface IActionProps {
  onAddDiscoveredTool: (
    gameId: string,
    toolId: string,
    result: IDiscoveredTool,
  ) => void;
  onSetToolVisible: (gameId: string, toolId: string, visible: boolean) => void;
  onShowError: (message: string, details?: any, allowReport?: boolean) => void;
  onShowDialog: (
    type: DialogType,
    title: string,
    content: IDialogContent,
    actions: DialogActions,
  ) => PromiseBB<IDialogResult>;
  onSetPrimary: (gameId: string, toolId: string) => void;
  onSetToolOrder: (gameId: string, tools: string[]) => void;
}

type IStarterProps = IBaseProps & IActionProps;
type WelcomeReducer = StateReducerType<IWelcomeScreenState>;
export default function Tools(props: IStarterProps) {
  const [state, dispatch] = React.useReducer<WelcomeReducer>(
    welcomeScreenStateReducer,
    initialState,
  );
  const { t } = useTranslation();
  const { onGetValidTools } = props;
  const context = React.useContext(MainContext);
  const { onShowError, onSetToolVisible, onSetPrimary, onSetToolOrder } =
    mapDispatchToProps(context.api.store.dispatch);
  const connectedProps: IConnectedProps = useSelector(mapStateToProps);
  const {
    discoveredGames,
    discoveredTools,
    gameMode,
    knownGames,
    toolsOrder,
    mods,
    primaryTool,
    deploymentCounter,
  } = connectedProps;
  const closeEditDialog = () => {
    dispatch([
      { type: propOf<IWelcomeScreenState>("editTool"), value: undefined },
      {
        type: propOf<IWelcomeScreenState>("counter"),
        value: state.counter + 1,
      },
    ]);
  };

  const applyOrder = React.useCallback(
    (ordered: string[]) => {
      const names = ordered
        .map((id) => {
          const tool = state.tools.find((tool) => tool.id === id);
          return tool?.name;
        })
        .filter((name) => !!name);
      context.api.events.emit(
        "analytics-track-event",
        "Tools",
        "Drag above/below",
        "Rearranged tools",
        names.join(),
      );
      onSetToolOrder(gameMode, ordered);
    },
    [onSetToolOrder, gameMode, state.tools],
  );

  const addNewTool = () => {
    const game: IGameStored = knownGames.find((ele) => ele.id === gameMode);
    const empty = new StarterInfo(game, discoveredGames[gameMode], undefined, {
      id: shortid(),
      path: "",
      hidden: false,
      custom: true,
      workingDirectory: "",
      name: "",
      executable: undefined,
      requiredFiles: [],
      logo: undefined,
      shell: false,
    });
    dispatch([{ type: propOf<IWelcomeScreenState>("editTool"), value: empty }]);
    context.api.events.emit("analytics-track-click-event", "Tools", "Add tool");
  };

  const startTool = React.useCallback(
    (info: StarterInfo) => {
      if (info?.exePath === undefined) {
        onShowError(
          "Tool missing/misconfigured",
          "Please ensure that the tool/game is configured correctly and try again",
          false,
        );
        return;
      }
      context.api.events.emit(
        "analytics-track-click-event",
        "Tools",
        "Manually ran tool",
      );
      StarterInfo.run(info, context.api, onShowError);
    },
    [onShowError],
  );

  const editTool = React.useCallback((starter: StarterInfo) => {
    dispatch([
      { type: propOf<IWelcomeScreenState>("editTool"), value: starter },
    ]);
  }, []);

  const removeTool = React.useCallback(
    (starter: StarterInfo) => {
      context.api.events.emit(
        "analytics-track-click-event",
        "Tools",
        "Removed tool",
      );
      onSetToolVisible(starter.gameId, starter.id, false);
    },
    [onSetToolVisible],
  );

  const setPrimary = React.useCallback(
    (starter: StarterInfo) => {
      if (starter.id === primaryTool) {
        onSetPrimary(starter.gameId, null);
      } else {
        context.api.events.emit(
          "analytics-track-click-event",
          "Tools",
          "Selected new primary tool",
        );
        onSetPrimary(starter.gameId, starter.isGame ? null : starter.id);
      }
    },
    [onSetPrimary],
  );

  const onStateUpdate = () => {
    const gameStarter = generateGameStarter(connectedProps);
    const tools = generateToolStarters(connectedProps, gameStarter?.id);
    dispatch([
      { type: propOf<IWelcomeScreenState>("gameStarter"), value: gameStarter },
      { type: propOf<IWelcomeScreenState>("tools"), value: tools },
    ]);
    const jumpList = truthy(gameStarter) ? [gameStarter].concat(tools) : tools;
    updateJumpList(jumpList);
  };

  React.useEffect(() => {
    // One time deal.
    onStateUpdate();
  }, []);

  React.useEffect(() => {
    const updateValidTools = async (tools: IStarterInfo[]) => {
      const valid = await onGetValidTools(tools, gameMode);
      dispatch([{ type: "validToolIds", value: valid }]);
    };
    onStateUpdate();
    updateValidTools(state.tools);
  }, [
    discoveredGames,
    gameMode,
    knownGames,
    toolsOrder,
    mods,
    deploymentCounter,
  ]);

  React.useEffect(() => {
    if (toolsOrder.length === 0 && state.tools.length > 0) {
      applyOrder(state.tools.map((tool) => tool.id));
    }
  }, [state.tools, toolsOrder]);
  let content: JSX.Element;
  const toolEditDialog = React.useCallback(
    () =>
      state.editTool !== undefined ? (
        <ToolEditDialog tool={state.editTool} onClose={closeEditDialog} />
      ) : null,
    [state.editTool, closeEditDialog],
  );
  if (gameMode === undefined) {
    content = (
      <EmptyPlaceholder
        fill={true}
        icon="game"
        text={t(
          "When you are managing a game, supported tools will appear here",
        )}
      />
    );
  } else {
    const game: IGameStored = knownGames.find((ele) => ele.id === gameMode);
    const discoveredGame = discoveredGames[gameMode];
    content = (
      <Media id="starter-dashlet">
        <FlexLayout className="starter-dashlet-tools-header" type="row">
          <div className="dashlet-title">{t("Tools")}</div>

          <DynDiv group="starter-dashlet-tools-controls" />
        </FlexLayout>

        <Media.Body>
          <FlexLayout type="column">
            {toolEditDialog()}

            <ToolIcons
              addNewTool={addNewTool}
              applyOrder={applyOrder}
              counter={state.counter}
              discoveredGame={discoveredGame}
              discoveredTools={discoveredTools}
              editTool={editTool}
              game={game}
              removeTool={removeTool}
              setPrimary={setPrimary}
              startTool={startTool}
              tools={state.tools}
              validToolIds={state.validToolIds}
            />
          </FlexLayout>
        </Media.Body>
      </Media>
    );
  }

  return (
    <Dashlet className="dashlet-starter" title="">
      {content}
    </Dashlet>
  );
}

interface IToolIconsProps {
  counter: number;
  game: IGameStored;
  discoveredGame: IDiscoveryResult;
  tools: IStarterInfo[];
  discoveredTools: { [id: string]: IDiscoveredTool };
  validToolIds: string[];
  applyOrder: (ordered: string[]) => void;
  addNewTool: () => void;
  startTool: (starter: StarterInfo) => void;
  editTool: (starter: StarterInfo) => void;
  removeTool: (starter: StarterInfo) => void;
  setPrimary: (starter: StarterInfo) => void;
}

function ToolIcons(props: IToolIconsProps): JSX.Element {
  const {
    counter,
    discoveredTools,
    tools,
    discoveredGame,
    validToolIds,
    game,
    applyOrder,
    addNewTool,
    editTool,
    removeTool,
    setPrimary,
    startTool,
  } = props;
  if (
    game === undefined &&
    getSafe(discoveredGame, ["id"], undefined) === undefined
  ) {
    return null;
  }

  if (tools === undefined) {
    return null;
  }

  const visible = tools.filter(
    (starter) =>
      starter.isGame ||
      discoveredTools[starter.id] === undefined ||
      discoveredTools[starter.id].hidden !== true,
  );
  return (
    <div className="tool-icon-box">
      {visible.map((starter: IStarterInfo, idx: number) => (
        <Tool
          applyOrder={applyOrder}
          counter={counter}
          editTool={editTool}
          idx={idx}
          key={starter.id + idx}
          removeTool={removeTool}
          setPrimary={setPrimary}
          starter={starter}
          startTool={startTool}
          tools={tools}
          validToolIds={validToolIds}
        />
      ))}

      <AddToolButton
        tools={tools}
        onAddNewTool={addNewTool}
        onSetToolOrder={applyOrder}
      />
    </div>
  );
}

function generateGameStarter(props: IConnectedProps): StarterInfo {
  const { discoveredGames, gameMode, knownGames } = props;

  const game: IGameStored = knownGames.find((ele) => ele.id === gameMode);
  const discoveredGame: IDiscoveryResult = discoveredGames[gameMode];

  if (game === undefined || discoveredGame?.path === undefined) {
    return null;
  }
  try {
    const starter = new StarterInfo(game, discoveredGame);
    return starter;
  } catch (unknownError) {
    const err = unknownToError(unknownError);
    log("error", "failed to create dashlet game entry", {
      error: err.message,
      stack: err.stack,
    });
  }
  return null;
}

function generateToolStarters(
  props: IConnectedProps,
  gameStarterId: string,
): StarterInfo[] {
  const { discoveredGames, discoveredTools, gameMode, knownGames, toolsOrder } =
    props;

  const game: IGameStored = knownGames.find((ele) => ele.id === gameMode);
  const discoveredGame: IDiscoveryResult = discoveredGames[gameMode];

  if (game === undefined || discoveredGame?.path === undefined) {
    return [];
  }

  const knownTools: IToolStored[] = getSafe(game, ["supportedTools"], []);
  const gameId = discoveredGame.id || game.id;
  const preConfTools = new Set<string>(knownTools.map((tool) => tool.id));

  const starters: StarterInfo[] = [];

  // add the tools provided by the game extension (whether they are found or not)
  knownTools.forEach((tool: IToolStored) => {
    try {
      starters.push(
        new StarterInfo(game, discoveredGame, tool, discoveredTools[tool.id]),
      );
    } catch (err) {
      log("warn", "invalid tool", { err });
    }
  });

  // finally, add those tools that were added manually
  Object.keys(discoveredTools)
    .filter((toolId) => !preConfTools.has(toolId) && toolId !== gameStarterId)
    .sort((lhs, rhs) => {
      const tlhs = discoveredTools[lhs]?.timestamp || 0;
      const trhs = discoveredTools[rhs]?.timestamp || 0;
      return tlhs - trhs;
    })
    .forEach((toolId) => {
      try {
        starters.push(
          new StarterInfo(
            game,
            discoveredGame,
            undefined,
            discoveredTools[toolId],
          ),
        );
      } catch (err) {
        log("error", "tool configuration invalid", {
          gameId,
          toolId,
          error: getErrorMessageOrDefault(err),
        });
      }
    });

  const findIdx = (starter: StarterInfo) => {
    const idx = toolsOrder.findIndex((toolId) => toolId === starter.id);
    return idx !== -1 ? idx : starters.length;
  };
  starters.sort((lhs, rhs) => findIdx(lhs) - findIdx(rhs));
  return starters;
}

const emptyObj = {};
const emptyArray = [];

let lastConnected: IConnectedProps;

function mapStateToProps(state: any): IConnectedProps {
  const gameMode: string = activeGameId(state);

  const res = {
    gameMode,
    addToTitleBar: getSafe(
      state,
      ["settings", "interface", "tools", "addToolsToTitleBar"],
      false,
    ),
    toolsOrder: getSafe(
      state,
      ["settings", "interface", "tools", "order", gameMode],
      emptyArray,
    ),
    knownGames: state.session.gameMode.known,
    discoveredGames: state.settings.gameMode.discovered,
    discoveredTools: getSafe(
      state,
      ["settings", "gameMode", "discovered", gameMode, "tools"],
      emptyObj,
    ),
    primaryTool: getSafe(
      state,
      ["settings", "interface", "primaryTool", gameMode],
      undefined,
    ),
    toolsRunning: state.session.base.toolsRunning,
    mods: getSafe(state, ["persistent", "mods", gameMode], emptyObj),
    deploymentCounter:
      state.persistent?.deployment?.deploymentCounter?.[gameMode] ?? 0,
  };

  const keys = Object.keys(res);
  if (
    lastConnected === undefined ||
    keys.find((key) => res[key] !== lastConnected[key]) !== undefined
  ) {
    lastConnected = res;
  }
  return lastConnected;
}

function mapDispatchToProps(
  dispatch: ThunkDispatch<any, null, Redux.Action>,
): IActionProps {
  return {
    onAddDiscoveredTool: (
      gameId: string,
      toolId: string,
      result: IDiscoveredTool,
    ) => {
      dispatch(addDiscoveredTool(gameId, toolId, result, true));
    },
    onSetToolVisible: (gameId: string, toolId: string, visible: boolean) => {
      dispatch(setToolVisible(gameId, toolId, visible));
    },
    onShowError: (message: string, details?: any, allowReport?: boolean) =>
      showError(dispatch, message, details, { allowReport }),
    onShowDialog: (type, title, content, actions) =>
      dispatch(showDialog(type, title, content, actions)),
    onSetPrimary: (gameId: string, toolId: string) =>
      dispatch(setPrimaryTool(gameId, toolId)),
    onSetToolOrder: (gameId: string, order: string[]) =>
      dispatch(setToolOrder(gameId, order)),
  };
}
