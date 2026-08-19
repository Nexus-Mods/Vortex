import path from "path";

import PromiseBB from "bluebird";
import memoize from "memoize-one";

import type { IState } from "@/types/api";

import type { IExtensionApi, IExtensionContext } from "../../types/IExtensionContext";
import type { ITestResult } from "../../types/ITestResult";
import * as fs from "../../util/fs";
import { activeGameId } from "../../util/selectors";
import type { IStarterInfo } from "../../util/StarterInfo";
import { getSafe } from "../../util/storeHelper";
import { truthy } from "../../util/util";
import { gameById, gameName } from "../gamemode_management/selectors";
import type { IDiscoveryResult } from "../gamemode_management/types/IDiscoveryResult";
import { incrementDeploymentCounter } from "../mod_management/reducers/deployment";
import { setPrimaryTool } from "./actions";
import settingsReducer from "./reducers";
import Tools from "./Tools";

function testPrimaryTool(api: IExtensionApi): PromiseBB<ITestResult> {
  const state = api.store.getState();

  const gameMode = activeGameId(state);
  if (gameMode === undefined) {
    return PromiseBB.resolve(undefined);
  }
  const primaryToolId = getSafe(
    state,
    ["settings", "interface", "primaryTool", gameMode],
    undefined,
  );

  if (truthy(primaryToolId)) {
    // We have a primary tool defined - ensure it's still valid.
    const primaryTool = getSafe(
      state,
      ["settings", "gameMode", "discovered", gameMode, "tools", primaryToolId],
      undefined,
    );

    // name the missing tool if we can (e.g. "Skyrim Script Extender 64"), the
    // discovered entry may be gone entirely so fall back to the game's tool list
    const toolName: string =
      primaryTool?.name ??
      gameById(state, gameMode)?.supportedTools?.find((tool) => tool.id === primaryToolId)?.name;

    const notifyInvalid = () => {
      const game = gameName(state, gameMode) ?? gameMode;
      const message = toolName !== undefined ? "{{toolName}} is missing" : "Invalid primary tool";
      const text =
        toolName !== undefined
          ? "{{toolName}}, the primary tool for {{game}}, could not be found. It may have" +
            " been moved or uninstalled. Quick launch has reverted to the game's executable."
          : "The primary tool for {{game}} is no longer available." +
            " Quick launch has reverted to the game's executable.";
      api.sendNotification({
        id: "invalid-primary-tool",
        type: "warning",
        message,
        replace: toolName !== undefined ? { toolName } : undefined,
        actions: [
          {
            title: "More",
            action: (dismiss) =>
              api.showDialog(
                "info",
                api.translate(message, { replace: { toolName } }),
                {
                  text: api.translate(text, { replace: { toolName, game } }),
                },
                [{ label: "Close", action: () => dismiss() }],
              ),
          },
        ],
      });
    };

    if (primaryTool === undefined || !truthy(primaryTool.path)) {
      notifyInvalid();
      api.store.dispatch(setPrimaryTool(gameMode, undefined));
    } else {
      const workingDir =
        primaryTool.workingDirectory !== undefined
          ? primaryTool.workingDirectory
          : path.dirname(primaryTool.path);

      // Make sure all the required files are still present.
      const requiredFiles = primaryTool.requiredFiles.map((file) => path.join(workingDir, file));
      return PromiseBB.each(requiredFiles, (file: string) => fs.statAsync(file))
        .then(() => PromiseBB.resolve(undefined))
        .catch((err) => {
          notifyInvalid();
          api.store.dispatch(setPrimaryTool(gameMode, undefined));
          return PromiseBB.resolve(undefined);
        });
    }
  }

  return PromiseBB.resolve(undefined);
}

const onDeploymentEvent = async (api: IExtensionApi): Promise<void> => {
  const state = api.store.getState();
  const gameMode = activeGameId(state);
  if (gameMode !== undefined) {
    // Increment deployment counter to trigger tool validation update
    api.store.dispatch(incrementDeploymentCounter(gameMode));
    await api.emitAndAwait("discover-tools", gameMode);
  }
};

const toolsValidation = memoize(validateTools);
function init(context: IExtensionContext): boolean {
  context.registerReducer(["settings", "interface"], settingsReducer);

  const onGetValidTools = (starters: IStarterInfo[], gameMode: string) =>
    toolsValidation(context.api, starters, gameMode);

  context.registerDashlet(
    "Tools",
    2,
    2,
    100,
    Tools,
    (state: IState) => !state.settings.window.useModernLayout,
    () => ({
      onGetValidTools,
    }),
    {
      closable: false,
    },
  );

  context.registerTest("primary-tool", "gamemode-activated", () => testPrimaryTool(context.api));

  context.once(() => {
    // Purging and deploying may change the tool state. We need to kick off
    //  a discovery event.
    context.api.onAsync("did-deploy", () => onDeploymentEvent(context.api));
    context.api.onAsync("did-purge", () => onDeploymentEvent(context.api));
  });
  return true;
}

function validateTools(api: IExtensionApi, starters: IStarterInfo[], gameMode: string) {
  const state = api.getState();
  const discovery: IDiscoveryResult = getSafe(
    state,
    ["settings", "gameMode", "discovered", gameMode],
    {},
  );
  if (discovery?.path === undefined) {
    return PromiseBB.resolve([]);
  }

  return PromiseBB.reduce(
    starters,
    (accum, iter) => {
      if (!iter?.exePath) {
        return PromiseBB.resolve(accum);
      }
      const exePath = path.isAbsolute(iter.exePath)
        ? iter.exePath
        : path.join(discovery.path, iter.exePath);
      return fs
        .statAsync(exePath)
        .then(() => accum.push(iter.id))
        .catch(() => PromiseBB.resolve())
        .then(() => PromiseBB.resolve(accum));
    },
    [],
  );
}

export default init;
