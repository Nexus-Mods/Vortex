/* eslint-disable */
import path from "path";

import { actions, selectors, types, util } from "@nexusmods/vortex-api";

import { withPositionPrefix } from "./collectionLoadOrder";
import { GAME_ID, I18N_NAMESPACE } from "./common";
import IniStructure from "./iniParser";
import TW3LoadOrder, { importLoadOrder } from "./loadOrder";
import { makeOnContextImport } from "./mergeBackup";
import { getPersistentLoadOrder } from "./migrations";
import { forceRefresh, isLockedEntry } from "./util";

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
            action: async () => {
              try {
                const profile = selectors.activeProfile(context.api.getState());
                const loadOrder = getPersistentLoadOrder(context.api);
                // Match on the folder name; the display name is the mod's Nexus
                // title, which doesn't carry the locked prefix.
                const locked = loadOrder.filter((entry) => isLockedEntry(entry.id));
                const sortable = loadOrder.filter((entry) => !isLockedEntry(entry.id));

                // The game falls back to ordering mod folders by name, and authors
                // name their mods to win or lose overrides on that basis.
                const sorted = [...sortable].sort((lhs, rhs) =>
                  lhs.id.toLowerCase().localeCompare(rhs.id.toLowerCase()),
                );

                const newLO = withPositionPrefix([...locked, ...sorted]);

                context.api.store.dispatch(actions.setLoadOrder(profile.id, newLO as any));
                // The refresh below makes the page re-read mods.settings, so the
                // new order has to reach the file first or it's just discarded.
                await IniStructure.getInstance(context.api).setINIStruct(newLO);
              } catch (err) {
                context.api.showErrorNotification("Failed to sort alphabetically", err);
              } finally {
                forceRefresh(context.api);
              }
            },
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
