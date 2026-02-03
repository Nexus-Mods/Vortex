import memoize from "memoize-one";
import * as path from "path";
import * as React from "react";
import { fs, selectors, types, util } from "vortex-api";

import settingsReducer from "./reducers";

import ToolStarter from "./ToolStarter";
import TitleBarToggle from "./TitlebarToggle";

import { starterMemoizer } from "./util";

const toStarters = memoize(starterMemoizer);
const getValidStarters = memoize(ValidStarters);
async function ValidStarters(
  game: types.IGameStored,
  discovery: types.IDiscoveryResult,
  tools: types.IDiscoveredTool[],
): Promise<string[]> {
  const starters = toStarters(game, discovery, tools);
  const validStarters: string[] = [];
  for (const starter of starters) {
    if (starter?.exePath === undefined) {
      // catch block below could catch this, but why waste time.
      continue;
    }
    try {
      const exePath = path.isAbsolute(starter.exePath)
        ? starter.exePath
        : path.join(discovery.path, starter.exePath);
      await fs.statAsync(exePath);
      validStarters.push(starter.id);
    } catch (err) {
      // nop
    }
  }
  return validStarters;
}

function init(context: types.IExtensionContext) {
  context.registerReducer(["settings", "interface"], settingsReducer);
  (context as any).registerDynDiv("main-toolbar", ToolStarter, {
    condition: (props: any): boolean => {
      return selectors.activeGameId(context.api.store.getState()) !== undefined;
    },
    props: {
      onGetStarters: (
        game: types.IGameStored,
        discovery: types.IDiscoveryResult,
        tools: types.IDiscoveredTool[],
      ) => toStarters(game, discovery, tools),
      onGetValidStarters: (
        game: types.IGameStored,
        discovery: types.IDiscoveryResult,
        tools: types.IDiscoveredTool[],
      ) => getValidStarters(game, discovery, tools),
    },
  });

  (context as any).registerDynDiv(
    "starter-dashlet-tools-controls",
    TitleBarToggle,
    {
      condition: (props: any): boolean => {
        return (
          selectors.activeGameId(context.api.store.getState()) !== undefined
        );
      },
      props: {
        onGetValidStarters: (
          game: types.IGameStored,
          discovery: types.IDiscoveryResult,
          tools: types.IDiscoveredTool[],
        ) => getValidStarters(game, discovery, tools),
      },
    },
  );

  context.once(() => {
    context.api.setStylesheet(
      "titlebar-launcher",
      path.join(__dirname, "titlebar-launcher.scss"),
    );
  });

  return true;
}

export default init;
