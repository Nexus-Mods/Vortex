import Bluebird from "bluebird";
import { actions, fs, selectors, types, util } from "vortex-api";

import path from "path";

import { UMM_EXE, UMM_ID } from "./common";

import { IUMMGameConfig } from "./types";

export function toBlue<T>(
  func: (...args: any[]) => Promise<T>,
): (...args: any[]) => Bluebird<T> {
  return (...args: any[]) => Bluebird.resolve(func(...args));
}

export function isUMMExecPred(filePath: string): boolean {
  return path.basename(filePath).toLowerCase() === UMM_EXE.toLowerCase();
}

export function setUMMPath(
  api: types.IExtensionApi,
  resolvedPath: string,
  gameId: string,
) {
  const state = api.store.getState();
  const tools = util.getSafe(
    state,
    ["settings", "gameMode", "discovered", gameId, "tools"],
    {},
  );

  const validTools = Object.keys(tools)
    .filter((key) => !!tools[key]?.path)
    .map((key) => tools[key]);

  const UMM = validTools.find((tool) => isUMMExecPred(tool.path));
  const ummId =
    UMM?.path !== undefined && path.dirname(UMM.path) === resolvedPath
      ? UMM.id
      : UMM_ID;

  createUMMTool(api, resolvedPath, ummId, gameId);
}
export function createUMMTool(
  api: types.IExtensionApi,
  ummPath: string,
  toolId: string,
  gameId: string,
) {
  api.store.dispatch(
    actions.addDiscoveredTool(
      gameId,
      toolId,
      {
        id: toolId,
        name: "Unity Mod Manager",
        logo: "umm.png",
        executable: () => UMM_EXE,
        requiredFiles: [UMM_EXE],
        path: path.join(ummPath, UMM_EXE),
        hidden: false,
        custom: false,
        defaultPrimary: true,
        workingDirectory: ummPath,
      },
      true,
    ),
  );
}
