import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IMod } from "../../mod_management/types/IMod";

import { addMod } from "../../mod_management/actions/mods";
import * as fs from "../../../util/fs";
import { log } from "../../../util/log";
import opn from "../../../util/opn";
import { activeGameId, installPath } from "../../../util/selectors";

import * as path from "path";

/**
 * Creates a new empty mod with the given name
 * @param api The extension API
 * @param name The name for the new mod
 */
export async function createNewMod(
  api: IExtensionApi,
  name: string,
): Promise<void> {
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
