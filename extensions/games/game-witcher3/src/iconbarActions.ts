/* eslint-disable */
import path from "path";

import { selectors, types, util } from "@nexusmods/vortex-api";

import { GAME_ID, I18N_NAMESPACE } from "./common";
import { applyAlphabeticalSort, importLoadOrder } from "./loadOrder";
import { makeOnContextImport } from "./mergeBackup";

interface IProps {
  context: types.IExtensionContext;
  // getModLimitPatcher: () => ModLimitPatcher;
}

export const registerActions = (props: IProps) => {
  const { context } = props;
  const openTW3DocPath = () => {
    const docPath = path.join(util.getVortexPath("documents"), "The Witcher 3");
    util.opn(docPath).catch(() => null);
  };

  const isTW3 = (gameId = undefined) => {
    if (gameId !== undefined) {
      return gameId === GAME_ID;
    }
    const state = context.api.getState();
    const gameMode = selectors.activeGameId(state);
    return gameMode === GAME_ID;
  };

  context.registerAction(
    "mods-action-icons",
    300,
    "start-install",
    {},
    "Import Script Merges",
    (instanceIds) => {
      makeOnContextImport(context.api, instanceIds[0]);
    },
    (instanceIds) => {
      const state = context.api.getState();
      const mods = util.getSafe(state, ["persistent", "mods", GAME_ID], {});
      if (mods[instanceIds?.[0]]?.type !== "collection") {
        return false;
      }
      const activeGameId = selectors.activeGameId(state);
      return activeGameId === GAME_ID;
    },
  );

  context.registerAction(
    "mods-action-icons",
    300,
    "start-install",
    {},
    "Import Load Order",
    (instanceIds) => {
      importLoadOrder(context.api, instanceIds[0]);
    },
    (instanceIds) => {
      const state = context.api.getState();
      const mods = util.getSafe(state, ["persistent", "mods", GAME_ID], {});
      if (mods[instanceIds?.[0]]?.type !== "collection") {
        return false;
      }
      const activeGameId = selectors.activeGameId(state);
      return activeGameId === GAME_ID;
    },
  );

  // context.registerAction('mod-icons', 500, 'savegame', {}, 'Apply Mod Limit Patch', () => {
  //   getModLimitPatcher().ensureModLimitPatch()
  //     .catch(err => {
  //       context.api.showErrorNotification('Failed to apply patch', err, {
  //         allowReport: (err instanceof util.ProcessCanceled),
  //       });
  //     });
  // }, () => selectors.activeGameId(context.api.getState()) === GAME_ID);

  context.registerAction(
    "mod-icons",
    300,
    "open-ext",
    {},
    "Open TW3 Documents Folder",
    openTW3DocPath,
    isTW3,
  );

  context.registerAction(
    "fb-load-order-icons",
    300,
    "open-ext",
    {},
    "Open TW3 Documents Folder",
    openTW3DocPath,
    isTW3,
  );

  context.registerAction(
    "fb-load-order-icons",
    100,
    "loot-sort",
    {},
    "Sort Alphabetically",
    () => {
      context.api.showDialog(
        "info",
        "Sort Alphabetically",
        {
          bbcode: context.api.translate(
            "This action will set priorities by sorting mod folder names alphabetically, " +
              "which is the order the game itself uses when no priority is set. " +
              "Are you sure you wish to proceed ?[br][/br][br][/br]" +
              "Merged scripts stay locked at the top. Everything else is reordered, including " +
              "mods added manually or by other tools.",
            { ns: I18N_NAMESPACE },
          ),
        },
        [
          {
            label: "Cancel",
            action: () => {
              return;
            },
          },
          {
            label: "Sort Alphabetically",
            action: () => applyAlphabeticalSort(context.api),
          },
        ],
      );
    },
    () => {
      const state = context.api.store.getState();
      const gameMode = selectors.activeGameId(state);
      return gameMode === GAME_ID;
    },
  );
};
