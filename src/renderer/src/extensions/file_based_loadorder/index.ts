import * as path from "path";

import { CycleError } from "@vortex/shared/errors";

import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IState } from "../../types/IState";
import * as fs from "../../util/fs";
import { log } from "../../util/log";
import type { IMod } from "../mod_management/types/IMod";
import sortMods from "../mod_management/util/sort";
import { activeGameId, activeProfile, profileById } from "../profile_management/selectors";
import type { IProfile } from "../profile_management/types/IProfile";
import { setFBLoadOrder } from "./actions/loadOrder";
import { collectionInterface, generate, parser } from "./collections/loadOrder";
import { LoadOrderRegistry } from "./gameSupport";
import { isInUse, onStartUp, registerLoadOrderHandlers, validateLoadOrder } from "./handlers";
import { REDUCER_BINDINGS } from "./reducers/bindings";
import { currentGameMods, currentLoadOrderForProfile } from "./selectors";
import type { ICollection } from "./types/collections";
import type { ILoadOrderEntry, ILoadOrderGameInfo, LoadOrder } from "./types/types";
import { errorHandler } from "./util";
import FileBasedLoadOrderPage from "./views/FileBasedLoadOrderPage";

export default function init(context: IExtensionContext) {
  const registry = new LoadOrderRegistry();
  const getGameEntry = (gameId: string) => registry.find(gameId);

  for (const { path: statePath, reducer } of REDUCER_BINDINGS) {
    context.registerReducer(statePath, reducer);
  }

  const setOrder = async (profileId: string, loadOrder: LoadOrder, refresh?: boolean) => {
    const profile = profileById(context.api.getState(), profileId);
    if (!profile) {
      context.api.showErrorNotification(
        "Failed to set load order",
        new Error("Please re-activate the game before trying again."),
        { allowReport: false },
      );
      return;
    }
    context.api.store.dispatch(setFBLoadOrder(profileId, loadOrder));
  };
  context.registerMainPage("sort-none", "Load order", FileBasedLoadOrderPage, {
    priority: 30,
    id: "file-based-loadorder",
    hotkey: "E",
    group: "per-game",
    visible: () => {
      const currentGameId = activeGameId(context.api.getState());
      return registry.entries(currentGameId).some(isInUse);
    },
    props: () => {
      return {
        getGameEntry,
        onSortByDeployOrder: async (profileId: string) => {
          const state = context.api.getState();
          const profile = profileById(state, profileId);
          const loadOrder = currentLoadOrderForProfile(state, profileId);
          // keyed by Vortex mod id
          const mods: Record<string, IMod> = currentGameMods(state);
          const filtered: IMod[] = Object.values(mods).filter(
            (m: IMod) => loadOrder.find((lo) => lo.modId === m.id) !== undefined,
          );
          let sorted: IMod[];
          try {
            sorted = await sortMods(profile.gameId, filtered, context.api);
          } catch (err) {
            if (err instanceof CycleError) {
              context.api.showErrorNotification(
                "Failed to sort mods",
                "The load order contains circular rules and cannot be sorted automatically. " +
                  "Please resolve conflicting rules in the mod dependencies.",
                { allowReport: false },
              );
              return;
            }
            throw err;
          }
          const findIndex = (entry: ILoadOrderEntry) => {
            return sorted.findIndex((m) => m.id === entry.modId);
          };
          const loadOrderSorted = [...loadOrder];
          loadOrderSorted.sort((a, b) => findIndex(a) - findIndex(b));
          context.api.store.dispatch(setFBLoadOrder(profileId, loadOrderSorted));
        },
        onImportList: async () => {
          const api = context.api;
          const file = await api.selectFile({
            filters: [{ name: "JSON", extensions: ["json"] }],
            title: "Import Load Order",
          });
          if (!file) {
            return;
          }
          try {
            const fileData = await fs.readFileAsync(file, { encoding: "utf8" });
            const loData: LoadOrder = JSON.parse(fileData);
            if (!Array.isArray(loData)) {
              throw new Error("invalid load order data");
            }
            const profileId = activeProfile(api.getState()).id;
            context.api.store.dispatch(setFBLoadOrder(profileId, loData));
            api.sendNotification({
              type: "success",
              message: "Load order imported",
              id: "import-load-order",
            });
          } catch (err) {
            api.showErrorNotification("Failed to import load order", err, {
              allowReport: false,
            });
          }
        },
        onExportList: async () => {
          const api = context.api;
          const state = api.getState();
          const profileId = activeProfile(state).id;
          const loadOrder = currentLoadOrderForProfile(state, profileId);
          const data = JSON.stringify(loadOrder, null, 2);
          const loPath = await api.saveFile({
            defaultPath: "loadorder.json",
            filters: [{ name: "JSON", extensions: ["json"] }],
            title: "Export Load Order",
          });
          if (loPath) {
            try {
              await fs.ensureDirWritableAsync(path.dirname(loPath));
              await fs.writeFileAsync(loPath, data);
              api.sendNotification({
                type: "success",
                message: "Load order exported",
                id: "export-load-order",
              });
            } catch (err) {
              api.showErrorNotification("Failed to export load order", err, {
                allowReport: false,
              });
            }
          }
        },
        validateLoadOrder: (profile: IProfile, loadOrder: LoadOrder) =>
          validateLoadOrder(context.api, registry, profile, loadOrder),
        onSetOrder: setOrder,
        onStartUp: (gameId: string) => onStartUp(context.api, registry, gameId),
        onShowError: (gameId: string, error: Error) =>
          errorHandler(context.api, gameId, getGameEntry(gameId), error),
      };
    },
  });

  context.registerLoadOrder = ((gameInfo: ILoadOrderGameInfo, extPath: string) => {
    registry.add(gameInfo, extPath);
  }) as any;

  // Expose a runtime API so callers that run after init (e.g. the
  // adaptor bridge's setup callback) can register load order pages.
  context.registerAPI(
    "addLoadOrderPage",
    (gameInfo: ILoadOrderGameInfo, isContributed?: boolean) =>
      registry.addInline(gameInfo, isContributed ?? false),
    { minArguments: 1 },
  );

  context.optional.registerCollectionFeature(
    "file_based_load_order_collection_data",
    (gameId: string, includedMods: string[]) => {
      // keyed by Vortex mod id
      const mods: Record<string, IMod> = currentGameMods(context.api.getState());
      return generate(context.api, getGameEntry(gameId), includedMods, mods);
    },
    (gameId: string, collection: ICollection) => parser(context.api, gameId, collection),
    () => Promise.resolve(),
    (t) => t("Load Order"),
    (_state: IState, gameId: string) => {
      const gameEntry = getGameEntry(gameId);
      if (gameEntry === undefined || !isInUse(gameEntry)) {
        return false;
      }
      return !(gameEntry.noCollectionGeneration ?? false);
    },
    collectionInterface(getGameEntry),
  );

  context.registerActionCheck("SET_FB_LOAD_ORDER", (_state, action) => {
    const { loadOrder } = (action as ReturnType<typeof setFBLoadOrder>).payload;
    if (!loadOrder || !Array.isArray(loadOrder)) {
      log("error", "invalid load order", loadOrder);
    }
    return undefined;
  });

  context.once(() => {
    registerLoadOrderHandlers(context.api, registry);
  });

  return true;
}
