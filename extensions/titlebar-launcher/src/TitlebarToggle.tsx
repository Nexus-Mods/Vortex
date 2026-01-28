import * as React from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { MainContext, selectors, Toggle, types, util } from "vortex-api";

import { setAddToTitleBar } from "./actions";

interface IConnectedProps {
  addToTitleBar: boolean;
  game: types.IGameStored;
  primaryTool: string;
  toolsOrder: string[];
  discovery: types.IDiscoveryResult;
  discoveredTools: { [id: string]: types.IDiscoveredTool };
  mods: { [modId: string]: types.IMod };
}

interface IProps {
  onGetValidStarters: (
    game: types.IGameStored,
    discovery: types.IDiscoveryResult,
    tools: types.IDiscoveredTool[],
  ) => Promise<string[]>;
}

export default function TitlebarToggle(props: IProps) {
  const [t] = useTranslation();
  const { onGetValidStarters } = props;
  const context = React.useContext(MainContext);
  const {
    game,
    addToTitleBar,
    discoveredTools,
    mods,
    toolsOrder,
    discovery,
    primaryTool,
  } = useSelector(mapStateToProps);
  const onToggle = React.useCallback(() => {
    context.api.store.dispatch(setAddToTitleBar(!addToTitleBar));
    if (!addToTitleBar === true) {
      context.api.events.emit(
        "analytics-track-click-event",
        "Tools",
        "Added to Titlebar",
      );
    }
  }, [addToTitleBar]);
  const [valid, setValid] = React.useState(false);
  React.useEffect(() => {
    const isValid = async () => {
      const hasValidTools =
        (await (
          await onGetValidStarters(
            game,
            discovery,
            Object.values(discoveredTools) || [],
          )
        ).length) > 0;
      setValid(hasValidTools);
    };
    isValid();
  }, [primaryTool, discoveredTools, toolsOrder, discovery, mods]);
  if (!game) {
    return null;
  }
  return (
    <div id="titlebar-tools-toggle-container">
      <p className="titlebar-tools-toggle-text">{t("Enable toolbar")}</p>
      <Toggle
        disabled={!valid}
        className="titlebar-tools-toggle"
        checked={addToTitleBar}
        onToggle={onToggle}
      />
    </div>
  );
}

const emptyObj = {};
function mapStateToProps(state: types.IState): IConnectedProps {
  const game: types.IGameStored = selectors.currentGame(state);
  const discovery: types.IDiscoveryResult =
    selectors.currentGameDiscovery(state);

  if (game?.id === undefined || discovery?.path === undefined) {
    return {
      game: undefined,
      addToTitleBar: false,
      discoveredTools: emptyObj,
      discovery: emptyObj,
      primaryTool: undefined,
      toolsOrder: [],
      mods: emptyObj,
    };
  }

  return {
    toolsOrder: util.getSafe(
      state,
      ["settings", "interface", "tools", "order", game.id],
      [],
    ),
    addToTitleBar: util.getSafe(
      state,
      ["settings", "interface", "tools", "addToolsToTitleBar"],
      false,
    ),
    game,
    primaryTool: util.getSafe(
      state,
      ["settings", "interface", "primaryTool", game.id],
      undefined,
    ),
    discovery,
    discoveredTools: util.getSafe(
      state,
      ["settings", "gameMode", "discovered", game.id, "tools"],
      emptyObj,
    ),
    mods: util.getSafe(state, ["persistent", "mods", game.id], emptyObj),
  };
}
