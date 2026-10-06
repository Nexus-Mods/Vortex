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
import { isPrimaryLoadOrderId } from "./registry";
import { currentGameMods, loadOrderForProfile } from "./selectors";
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

  const setOrder = (profileId: string, loadOrder: LoadOrder, loadOrderId?: string) => {
    const profile = profileById(context.api.getState(), profileId);
    if (!profile) {
      context.api.showErrorNotification(
        "Failed to set load order",
        new Error("Please re-activate the game before trying again."),
        { allowReport: false },
      );
      return;
    }
    // a primary write carries no id; community extensions read that payload
    context.api.store.dispatch(
      setFBLoadOrder(
        profileId,
        loadOrder,
        isPrimaryLoadOrderId(loadOrderId) ? undefined : loadOrderId,
      ),
    );
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
        getGameEntries: (gameId: string) => registry.entries(gameId).filter(isInUse),
        onSortByDeployOrder: async (profileId: string, loadOrderId?: string) => {
          const state = context.api.getState();
          const profile = profileById(state, profileId);
          const loadOrder = loadOrderForProfile(state, profileId, loadOrderId);
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
          context.api.store.dispatch(setFBLoadOrder(profileId, loadOrderSorted, loadOrderId));
        },
        onImportList: async (loadOrderId?: string) => {
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
            context.api.store.dispatch(setFBLoadOrder(profileId, loData, loadOrderId));
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
        onExportList: async (loadOrderId?: string) => {
          const api = context.api;
          const state = api.getState();
          const profileId = activeProfile(state).id;
          const loadOrder = loadOrderForProfile(state, profileId, loadOrderId);
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
        validateLoadOrder: (profile: IProfile, loadOrder: LoadOrder, loadOrderId?: string) =>
          validateLoadOrder(context.api, registry, profile, loadOrder, loadOrderId),
        onSetOrder: setOrder,
        onStartUp: (gameId: string, loadOrderId?: string) =>
          onStartUp(context.api, registry, gameId, loadOrderId),
        onShowError: (gameId: string, error: Error, loadOrderId?: string) =>
          errorHandler(context.api, gameId, registry.find(gameId, loadOrderId), error),
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
      return generate(context.api, registry.entries(gameId).filter(isInUse), includedMods, mods);
    },
    (gameId: string, collection: ICollection) =>
      parser(context.api, registry.entries(gameId), gameId, collection),
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
