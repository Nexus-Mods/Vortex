import type {
  IExtensionApi,
  IExtensionContext,
} from "../../types/IExtensionContext";
import type { IDialogResult } from "../../types/IDialog";
import type { IMod } from "../mod_management/types/IMod";

import { addMod } from "../mod_management/actions/mods";
import * as fs from "../../util/fs";
import { log } from "../../util/log";
import opn from "../../util/opn";
import { activeGameId, installPath } from "../../util/selectors";

import * as path from "path";

/**
 * Entry point for the extension.
 * Registers the "Create new mod" action in the mod list toolbar.
 */
function init(context: IExtensionContext): boolean {
  context.registerAction(
    "mod-icons",
    50,
    "add",
    {},
    "Create new mod",
    () => {
      promptCreateMod(context.api);
    },
    () => true,
  );

  return true;
}

async function promptCreateMod(api: IExtensionApi): Promise<void> {
  try {
    const result = await api.showDialog?.(
      "question",
      "Create new mod",
      {
        text: "To create a new, empty mod enter the name of the mod below.",
        input: [
          {
            id: "modName",
            type: "text",
            label: "Mod Name",
            placeholder: "Enter a name for the new mod",
          },
        ],
      },
      [{ label: "Cancel" }, { label: "Create Mod", default: true }],
    );

    if (result?.action === "Cancel" || result === undefined) {
      return;
    }

    if (!result.input.modName) {
      api.showErrorNotification?.(
        "Missing Mod Name",
        "Please enter a name to create a new mod",
      );
      return;
    }

    await createNewMod(api, result.input.modName);
  } catch (err) {
    log("error", "Failed to show create mod dialog", err);
  }
}

async function createNewMod(api: IExtensionApi, name: string): Promise<void> {
  const id = `custom-mod-${Date.now()}`;
  const state = api.getState();
  const gameId = activeGameId(state);
  const stagingPath = installPath(state);

  if (stagingPath === undefined) {
    api.showErrorNotification?.(
      "Cannot create mod",
      "No game is currently being managed",
    );
    return;
  }

  const modInstallPath = path.join(stagingPath, id);

  const newMod: IMod = {
    id,
    state: "installed",
    type: "",
    installationPath: id,
    attributes: {
      name,
      author: "Me",
      installTime: new Date().toISOString(),
      version: "1.0.0",
      notes: "Created with Create New Mod",
      source: "user-generated",
    },
  };

  try {
    await fs.ensureDirAsync(modInstallPath);
    api.store?.dispatch(addMod(gameId, newMod));

    api.sendNotification?.({
      id: "mod-created",
      type: "success",
      title: "Mod Created",
      message: name,
      displayMS: 10000,
      actions: [
        {
          title: "Open Folder",
          action: (dismiss) => {
            opn(modInstallPath).catch(() => undefined);
            dismiss();
          },
        },
      ],
    });
  } catch (err) {
    log("error", "Failed to create new mod", err);
    api.showErrorNotification?.("Failed to create mod", err);
  }
}

export default init;
