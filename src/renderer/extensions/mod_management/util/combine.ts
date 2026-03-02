import * as path from "path";
import { generate as shortid } from "shortid";
import type {
  IDeploymentMethod,
  IExtensionApi,
} from "../../../types/IExtensionContext";
import { ProcessCanceled, UserCanceled } from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import { log } from "../../../util/log";
import { getSafe } from "../../../util/storeHelper";
import { toPromise } from "../../../util/util";
import { onAddMod } from "../eventHandlers";
import { installPathForGame } from "../selectors";
import allTypesSupported from "./allTypesSupported";
import { getAllActivators } from "./deploymentMethods";
import modName from "./modName";
import { removeMod, removeMods } from "./removeMods";
import sortMods, { CycleError } from "./sort";
import { getErrorMessageOrDefault } from "@vortex/shared";

async function combineMods(
  api: IExtensionApi,
  gameId: string,
  modIds: string[],
) {
  const state = api.getState();
  const mods = state.persistent.mods[gameId];
  const stagingPath = installPathForGame(state, gameId);

  if (modIds.find((modId) => mods[modId] === undefined) !== undefined) {
    return api.showDialog(
      "error",
      "Combining these mods isn't possible",
      {
        text: "You can only combine installed mods.",
      },
      [{ label: "Close" }],
    );
  }

  const activatorId: string = getSafe(
    state,
    ["settings", "mods", "activator", gameId],
    undefined,
  );
  const activators = getAllActivators();
  const modTypes = new Set(modIds.map((modId) => mods[modId]?.type));

  {
    if (modTypes.size > 1) {
      return api.showDialog(
        "error",
        "Combining these mods isn't possible",
        {
          text:
            "You can only combine mods that have the same mod type, otherwise " +
            "they couldn't deploy correctly any more.",
        },
        [{ label: "Close" }],
      );
    }
  }

  const activator: IDeploymentMethod =
    activatorId !== undefined
      ? activators.find((act) => act.id === activatorId)
      : activators.find(
          (act) =>
            allTypesSupported(act, state, gameId, Array.from(modTypes)).errors
              .length === 0,
        );

  if (activator === undefined) {
    return api.showDialog(
      "error",
      "Combining these mods not possible",
      {
        text: "No deployment method is currently configured for this game.",
      },
      [{ label: "Close" }],
    );
  }

  const combineId = shortid();
  const tempName = "__combine" + combineId;

  try {
    const sorted = await sortMods(
      gameId,
      modIds.map((id) => mods[id]),
      api,
    );
    const result = await api.showDialog(
      "question",
      "Combine Mods",
      {
        bbcode:
          "You are combining the mods listed below into the selected one.<br/>" +
          "Please be aware that Vortex will then only track updates for the one " +
          "mod that remains and if you do update or reinstall it, the other mods are gone.<br/>" +
          "Thus we would suggest you [color=red]only use this to merge in patches/fixes[/color] that " +
          "become obsolete with the next update anyway.<br/>" +
          "If there are file conflicts between these mods they will be overwritten in " +
          "the order specified by mod rules (same way as deployment would have).",
        choices: sorted.map((mod, idx) => ({
          id: mod.id,
          text:
            modName(mod, { version: true }) + " - " + mod.attributes?.fileType,
          value: idx === 0,
        })),
      },
      [{ label: "Cancel" }, { label: "Continue" }],
    );

    if (result.action !== "Continue") {
      return Promise.resolve();
    }

    const keys = Object.keys(result.input);
    const targetId = keys.find((id) => result.input[id]);
    const targetIdx = sorted.findIndex((mod) => mod.id === targetId);
    const target = mods[targetId];
    const sourceIds = Object.keys(result.input).filter(
      (id) => !result.input[id],
    );

    await toPromise<void>((cb) =>
      onAddMod(
        api,
        gameId,
        {
          id: tempName,
          state: "installed",
          attributes: {
            name: "Combination in progress - Leave this alone!",
          },
          installationPath: tempName,
          type: "",
        },
        cb,
      ),
    );

    for (const mod of sorted) {
      // copy files from source mods, overwriting existing files in the order
      // they would be deployed
      await fs.copyAsync(
        path.join(stagingPath, mod.installationPath),
        path.join(stagingPath, tempName),
      );
    }

    // merge is done, swap the directories of the temporary merge mod with the
    // merge target so that meta information is maintained

    await fs.renameAsync(
      path.join(stagingPath, target.installationPath),
      path.join(stagingPath, tempName + "_delme"),
    );
    try {
      await fs.renameAsync(
        path.join(stagingPath, tempName),
        path.join(stagingPath, target.installationPath),
      );
    } catch (err) {
      // if this fails for an inexplicable reason we have to restore the temporary directory
      await fs.renameAsync(
        path.join(stagingPath, tempName + "_delme"),
        path.join(stagingPath, target.installationPath),
      );
    }

    await fs.renameAsync(
      path.join(stagingPath, tempName + "_delme"),
      path.join(stagingPath, tempName),
    );

    // merge is done, remove the source mods
    await removeMods(api, gameId, [...sourceIds, tempName]);
  } catch (err) {
    if (api.getState().persistent.mods[gameId][tempName] !== undefined) {
      try {
        // remove the temporary mod, if it was created
        await removeMod(api, gameId, tempName);
      } catch (err) {
        log("error", "failed to remove temporary directory", {
          tempName,
          error: getErrorMessageOrDefault(err),
        });
      }
    }
    if (err instanceof UserCanceled) {
      // nop
    } else if (err instanceof ProcessCanceled) {
      api.sendNotification({
        type: "warning",
        message: err.message,
      });
    } else {
      const allowReport = !(err instanceof CycleError);
      api.showErrorNotification("Failed to combine mods", err, {
        allowReport,
      });
    }
  }
}

export default combineMods;
