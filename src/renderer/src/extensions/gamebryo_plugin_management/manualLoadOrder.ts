import * as path from "path";

import { VortexGameId } from "@vortex/shared";

import type { IExtensionApi } from "../../types/IExtensionContext";
import { batchDispatch } from "../../util/util";
import type {
  ILoadOrderGameInfo,
  IValidationResult,
  LoadOrder,
} from "../file_based_loadorder/types/types";
import { needToDeploy } from "../mod_management/selectors";
import { activeProfile } from "../profile_management/selectors";
import { setPluginEnabled, updatePluginOrder } from "./actions/loadOrder";
import { isBetaLoadOrder, supportsBetaLoadOrder } from "./betaLoadOrder";
import { ESPFile } from "./esp/ESPFile";
import { gameSupported, nativePlugins, supportedGames } from "./util/gameSupport";
import { isGhosted } from "./util/ghost";

interface IPluginOrderData {
  native: boolean;
  isMaster: boolean;
  masters: string[];
}
type PluginOrder = LoadOrder & Array<LoadOrder[number] & { data: IPluginOrderData }>;

export function validateManualLoadOrder(
  baseline: PluginOrder,
  current: LoadOrder,
): IValidationResult | undefined {
  const invalid: IValidationResult["invalid"] = [];
  const positions = new Map(current.map((entry, index) => [entry.id, index]));
  if (
    positions.size !== current.length ||
    current.length !== baseline.length ||
    baseline.some((entry) => !positions.has(entry.id))
  ) {
    return {
      invalid: [
        {
          id: current[0]?.id ?? "plugins",
          reason: "The deployed plugins changed. Refresh the list before ordering.",
        },
      ],
    };
  }
  const native = baseline.filter((entry) => entry.data.native);
  native.forEach((entry, index) => {
    if (current[index]?.id !== entry.id || !current[index]?.enabled) {
      invalid.push({
        id: entry.id,
        reason: "Base game plugins must stay enabled at the start of the order.",
      });
    }
  });
  const byId = new Map(baseline.map((entry) => [entry.id, entry]));
  let nonMasterSeen = false;
  for (const entry of current) {
    const info = byId.get(entry.id).data;
    if (!info.isMaster && !info.native) nonMasterSeen = true;
    if (info.isMaster && nonMasterSeen)
      invalid.push({ id: entry.id, reason: "Master plugins must load before non-master plugins." });
    if (!entry.enabled) continue;
    for (const name of info.masters) {
      const master = current.find((candidate) => candidate.id === name.toLowerCase());
      if (!master?.enabled || positions.get(master.id) >= positions.get(entry.id)) {
        invalid.push({
          id: entry.id,
          reason: `Required master ${name} must be enabled and load earlier.`,
        });
      }
    }
  }
  return invalid.length > 0 ? { invalid } : undefined;
}

export function makeManualLoadOrder(api: IExtensionApi, gameId: VortexGameId): ILoadOrderGameInfo {
  const condition = () =>
    activeProfile(api.getState())?.gameId === gameId &&
    gameSupported(gameId) &&
    isBetaLoadOrder(api.getState());
  const read = async (): Promise<PluginOrder> => {
    const state = api.getState();
    if (!condition()) return [];
    const native = nativePlugins(gameId);
    const result = await Promise.all(
      Object.entries(state.session.plugins.pluginList ?? {})
        .filter(([, plugin]) => plugin.deployed && !isGhosted(plugin.filePath))
        .map(async ([id, plugin]) => {
          const parsed = await ESPFile.open(plugin.filePath, gameId);
          const isNative = plugin.isNative || native.includes(id);
          return {
            id,
            name: path.basename(plugin.filePath),
            enabled: isNative || state.loadOrder[id]?.enabled === true,
            locked: isNative,
            modId: plugin.modId,
            data: { native: isNative, isMaster: parsed.isMaster, masters: parsed.masterList },
          };
        }),
    );
    if (
      activeProfile(api.getState())?.id !== activeProfile(state)?.id ||
      api.getState().session.plugins.pluginList !== state.session.plugins.pluginList ||
      !condition()
    ) {
      throw new Error("The active game or deployed plugins changed. Refresh the list.");
    }
    const rank = (id: string) =>
      state.loadOrder[id]?.loadOrder >= 0 ? state.loadOrder[id].loadOrder : Number.MAX_SAFE_INTEGER;
    return result.sort((lhs, rhs) => {
      if (lhs.data.native !== rhs.data.native) return lhs.data.native ? -1 : 1;
      if (lhs.data.native) return native.indexOf(lhs.id) - native.indexOf(rhs.id);
      if (lhs.data.isMaster !== rhs.data.isMaster) return lhs.data.isMaster ? -1 : 1;
      return rank(lhs.id) - rank(rhs.id) || lhs.name.localeCompare(rhs.name);
    });
  };
  const validate = async (_previous: LoadOrder, current: LoadOrder) =>
    validateManualLoadOrder(await read(), current);
  return {
    gameId,
    loadOrderId: "bethesda-plugins",
    reorderOnDirectHover: true,
    displayName: "Plugins",
    conflictWinner: "last",
    toggleableEntries: true,
    clearStateOnPurge: false,
    noCollectionGeneration: true,
    usageInstructions:
      "Drag plugins to change their load order, or edit a position number. Lower entries override earlier ones. Base game plugins are locked; masters must load before their dependants. Use Sort via LOOT to sort once.",
    condition,
    deserializeLoadOrder: read,
    validate,
    serializeLoadOrder: async (current) => {
      const state = api.getState();
      const profileId = activeProfile(state)?.id;
      const baseline = await read();
      if (
        !condition() ||
        activeProfile(api.getState())?.id !== profileId ||
        api.getState().loadOrder !== state.loadOrder ||
        needToDeploy(api.getState()) ||
        (api.getState().session.base.activity.mods?.length ?? 0) > 0 ||
        (api.getState().session.base.activity.plugins?.length ?? 0) > 0
      ) {
        throw new Error("Wait for deployment or sorting to finish, then refresh the list.");
      }
      const invalid = validateManualLoadOrder(baseline, current);
      if (invalid) throw new Error(invalid.invalid.map((entry) => entry.reason).join("\n"));
      if (current.length === 0) return;
      const locks = state.persistent.plugins.lockedIndices?.[gameId] ?? {};
      if (Object.keys(locks).length > 0)
        throw new Error("Remove plugin index locks before editing manual load order.");
      const byId = new Map(baseline.map((entry) => [entry.id, entry]));
      batchDispatch(api.store, [
        updatePluginOrder(
          current.map((entry) => byId.get(entry.id).name),
          false,
          false,
        ),
        ...current
          .filter((entry) => !byId.get(entry.id).data.native)
          .map((entry) => setPluginEnabled(byId.get(entry.id).name, entry.enabled)),
      ]);
    },
  };
}

export function registerManualLoadOrders(api: IExtensionApi): void {
  // Starfield and Oblivion Remastered already provide their own Load Order registrations.
  for (const id of supportedGames().map(VortexGameId).filter(supportsBetaLoadOrder)) {
    api.ext.addLoadOrderPage(makeManualLoadOrder(api, id));
  }
}
