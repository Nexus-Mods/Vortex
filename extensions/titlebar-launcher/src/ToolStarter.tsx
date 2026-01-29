import * as path from "path";
import * as React from "react";
import { useSelector } from "react-redux";
import { fs, selectors, Spinner, ToolIcon, types, util } from "vortex-api";

// tslint:disable-next-line:no-var-requires
const { MainContext } = require("vortex-api");

interface IConnectedProps {
  addToTitleBar: boolean;
  toolsOrder: types.IStarterInfo[];
  game: types.IGameStored;
  discovery: types.IDiscoveryResult;
  discoveredTools: { [id: string]: types.IDiscoveredTool };
  primaryTool: string;
  toolsRunning: { [exeId: string]: types.IRunningTool };
  mods: { [modId: string]: types.IMod };
}

interface IToolStarterProps {
  onGetStarters: (
    game: types.IGameStored,
    discovery: types.IDiscoveryResult,
    tools: types.IDiscoveredTool[],
  ) => types.IStarterInfo[];
  onGetValidStarters: (
    game: types.IGameStored,
    discovery: types.IDiscoveryResult,
    tools: types.IDiscoveredTool[],
  ) => Promise<string[]>;
}

interface IToolStarterIconProps {
  tool: types.IStarterInfo;
  running: boolean;
  iconLocation: string;
  valid: boolean;
}

function toolIconRW(gameId: string, toolId: string) {
  return path.join(
    (util as any).getVortexPath("userData"),
    gameId,
    "icons",
    toolId + ".png",
  );
}

async function toolIcon(
  gameId: string,
  extensionPath: string,
  toolId: string,
  toolLogo: string,
): Promise<string> {
  try {
    const iconPath = toolIconRW(gameId, toolId);
    await fs.statAsync(iconPath);
    return iconPath;
  } catch (err) {
    if (toolLogo === undefined) {
      return undefined;
    }
    try {
      const iconPath = path.join(extensionPath, toolLogo);
      await fs.statAsync(iconPath);
      return iconPath;
    } catch (err) {
      return undefined;
    }
  }
}

function ToolStarterIcon(props: IToolStarterIconProps) {
  const { valid } = props;
  const { api }: { api: types.IExtensionApi } = React.useContext(MainContext);
  const { primaryTool } = useSelector(mapStateToProps);

  const onShowError = React.useCallback(
    (message: string, details: any, allowReport: boolean) => {
      api.showErrorNotification(message, details, { allowReport });
    },
    [api],
  );

  const startCB = React.useCallback(() => {
    api.events.emit(
      "analytics-track-click-event",
      "Tools",
      "Manually ran tool",
    );
    util.StarterInfo.run(props.tool as any, api, onShowError);
  }, [props]);

  return valid ? (
    <ToolIcon
      classes={["fade-in"]}
      t={api.translate}
      valid={true}
      item={props.tool}
      isPrimary={props.tool.id === primaryTool}
      imageUrl={props.iconLocation}
      onRun={startCB}
    >
      {props.running ? <Spinner className="running-overlay" /> : null}
    </ToolIcon>
  ) : null;
}

function makeExeId(exePath: string): string {
  return path.basename(exePath).toLowerCase();
}

function ToolStarter(props: IToolStarterProps) {
  const { onGetStarters, onGetValidStarters } = props;
  const {
    addToTitleBar,
    discovery,
    game,
    discoveredTools,
    mods,
    toolsRunning,
    toolsOrder,
    primaryTool,
  } = useSelector(mapStateToProps);

  const [toolImages, setToolImages] = React.useState({});
  const [validStarters, setValidStarters] = React.useState([]);
  const starters = onGetStarters(
    game,
    discovery,
    Object.values(discoveredTools) || [],
  );
  const idxOfTool = (tool) => {
    const idx = toolsOrder.findIndex((id) => tool.id === id);
    return idx !== -1 ? idx : starters.length;
  };
  starters.sort((lhs, rhs) => idxOfTool(lhs) - idxOfTool(rhs));
  React.useEffect(() => {
    const hasValidTools = async () => {
      const starters = await onGetValidStarters(
        game,
        discovery,
        Object.values(discoveredTools),
      );
      setValidStarters(starters);
    };
    const getImagePath = async () => {
      const imageMap = {};
      for (const starter of starters) {
        imageMap[starter.id] = await toolIcon(
          game.id,
          game.extensionPath,
          starter.id,
          starter.logoName,
        );
      }
      setToolImages(imageMap);
      hasValidTools();
    };
    getImagePath();
  }, [primaryTool, discoveredTools, toolsOrder, discovery, mods]);
  if (!game || !discovery || !addToTitleBar || validStarters.length === 0) {
    return null;
  }
  return (
    <div id="titlebar-starter">
      {starters.map((starter, idx) => {
        const running =
          starter.exePath !== undefined &&
          toolsRunning[makeExeId(starter.exePath)] !== undefined;

        return (
          <ToolStarterIcon
            valid={validStarters.includes(starter.id)}
            running={running}
            key={idx}
            tool={starter}
            iconLocation={toolImages[starter.id]}
          />
        );
      })}
    </div>
  );
}

const emptyObj = {};

function mapStateToProps(state: types.IState): IConnectedProps {
  const game: types.IGameStored = selectors.currentGame(state);
  const discovery: types.IDiscoveryResult =
    selectors.currentGameDiscovery(state);

  if (!game?.id || !discovery?.path) {
    return {
      addToTitleBar: false,
      toolsOrder: [],
      game: undefined,
      discovery: undefined,
      discoveredTools: emptyObj,
      primaryTool: undefined,
      toolsRunning: emptyObj,
      mods: emptyObj,
    };
  }
  return {
    addToTitleBar: util.getSafe(
      state,
      ["settings", "interface", "tools", "addToolsToTitleBar"],
      false,
    ),
    toolsOrder: util.getSafe(
      state,
      ["settings", "interface", "tools", "order", game.id],
      [],
    ),
    game,
    discovery,
    discoveredTools:
      game !== undefined
        ? util.getSafe(
            state,
            ["settings", "gameMode", "discovered", game.id, "tools"],
            emptyObj,
          )
        : undefined,
    primaryTool:
      game !== undefined
        ? util.getSafe(
            state,
            ["settings", "interface", "primaryTool", game.id],
            undefined,
          )
        : undefined,
    toolsRunning: state.session.base.toolsRunning,
    mods:
      game !== undefined
        ? util.getSafe(state, ["persistent", "mods", game.id], emptyObj)
        : emptyObj,
  };
}

export default ToolStarter;
