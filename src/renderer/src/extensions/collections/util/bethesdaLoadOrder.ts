import { getErrorMessageOrDefault, VortexGameId } from "@vortex/shared";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import { collectionNamedLoadOrderSchema } from "../../file_based_loadorder/types/collections";
import type { LoadOrder } from "../../file_based_loadorder/types/types";
import {
  isBetaLoadOrder,
  supportsBetaLoadOrder,
} from "../../gamebryo_plugin_management/betaLoadOrder";
import {
  BETHESDA_PLUGIN_ORDER_ID,
  makeManualLoadOrder,
} from "../../gamebryo_plugin_management/manualLoadOrder";
import { pluginManagementEnabled } from "../../gamebryo_plugin_management/util/gameSupport";
import type { IMod } from "../../mod_management/types/IMod";
import { findModByRef } from "../../mod_management/util/findModByRef";
import { isDependencyRule } from "../../mod_management/util/testModReference";
import { activeProfile } from "../../profile_management/selectors";
import type { IProfile } from "../../profile_management/types/IProfile";
import type { ICollection } from "../types/ICollection";

export type SavedOrderChoice = "apply" | "keep";

export interface ICollectionProfileSelection {
  newProfileId?: string;
  activateProfile?: (profileId: string) => Promise<void>;
}

export function savedBethesdaOrder(collection: ICollection): LoadOrder | undefined {
  if (!Array.isArray(collection.fbLoadOrders)) return undefined;
  const orders = collection.fbLoadOrders.filter((order) => order?.id === BETHESDA_PLUGIN_ORDER_ID);
  if (orders.length !== 1) return undefined;
  const parsed = collectionNamedLoadOrderSchema.safeParse(orders[0]);
  if (!parsed.success || parsed.data.entries.length === 0) return undefined;
  const entries = parsed.data.entries;
  const ids = new Set(entries.map((entry) => entry.id.toLowerCase()));
  return ids.size === entries.length && !ids.has("") ? entries : undefined;
}

export async function chooseCollectionLoadOrder(
  api: IExtensionApi,
  profile: IProfile,
  selection: ICollectionProfileSelection,
  previousChoice?: SavedOrderChoice,
): Promise<SavedOrderChoice | "cancel"> {
  const { id, gameId, name } = profile;
  const state = api.getState();
  if (!pluginManagementEnabled(state, gameId, id)) return "keep";
  const isNew = selection.newProfileId === id;
  const isActive = activeProfile(state)?.id === id;
  const apply = "Use Saved Order";
  const keep = "Keep Current Sorting";
  if (previousChoice === "keep") return "keep";
  const returningFromClassic = previousChoice === "apply" && !isBetaLoadOrder(state, profile);
  if (returningFromClassic || (previousChoice === undefined && (!isNew || !isActive))) {
    const choice = await api.showDialog(
      "question",
      "Use the collection's saved load order?",
      {
        text: returningFromClassic
          ? "This profile now uses Classic. Using the saved order switches it back to Beta and rearranges the collection's plugins. Keeping your current sorting resumes the install in Classic."
          : isActive
            ? "This collection includes a manual plugin order. Using it enables Beta load order and rearranges the collection's plugins in this profile. Keeping your current sorting installs the collection without applying its saved order."
            : "This collection includes a manual plugin order. Using it activates the selected profile, enables Beta load order and applies the saved order there.",
        message: name,
      },
      [
        { label: "Cancel", default: isNew },
        ...(!isNew ? [{ label: keep, default: true }] : []),
        ...(isActive || selection.activateProfile !== undefined ? [{ label: apply }] : []),
      ],
    );
    if (choice.action !== apply) return choice.action === keep ? "keep" : "cancel";
  }
  if (!isActive) await selection.activateProfile?.(id);
  const current = api.getState();
  if (activeProfile(current)?.id !== id || !pluginManagementEnabled(current, gameId, id)) {
    return "cancel";
  }
  return "apply";
}

export function mergeCollectionPluginOrder(
  deployed: LoadOrder,
  saved: LoadOrder,
  memberIds: Set<string>,
): LoadOrder {
  const members = new Map(
    deployed
      .filter((entry) => !entry.locked && memberIds.has(entry.modId))
      .map((entry) => [entry.id, entry]),
  );
  const ordered = saved.flatMap((entry) => {
    const installed = members.get(entry.id.toLowerCase());
    return installed ? [{ ...installed, enabled: entry.enabled }] : [];
  });
  const orderedIds = new Set(ordered.map((entry) => entry.id));
  let index = 0;
  return deployed.map((entry) => (orderedIds.has(entry.id) ? ordered[index++] : entry));
}

export async function applyCollectionPluginOrder(
  api: IExtensionApi,
  profileId: string,
  gameId: string,
  collection: ICollection,
  collectionMod: IMod,
): Promise<void> {
  const state = api.getState();
  const profile = activeProfile(state);
  const saved = savedBethesdaOrder(collection);
  if (!saved || profile?.id !== profileId || profile.gameId !== gameId || !isBetaLoadOrder(state)) {
    return;
  }
  try {
    const mods = state.persistent.mods[gameId] ?? {};
    const rules = (mods[collectionMod.id] ?? collectionMod).rules;
    const memberIds = new Set(
      rules
        .filter(isDependencyRule)
        .map((rule) => findModByRef(rule.reference, mods))
        .filter((mod) => mod && profile.modState[mod.id]?.enabled)
        .map((mod) => mod.id),
    );
    const adapter = makeManualLoadOrder(api, VortexGameId(gameId));
    const deployed = await adapter.deserializeLoadOrder();
    if (activeProfile(api.getState())?.id !== profileId) return;
    const merged = mergeCollectionPluginOrder(deployed, saved, memberIds);
    if (
      merged.some(
        (entry, index) =>
          entry.id !== deployed[index].id || entry.enabled !== deployed[index].enabled,
      )
    ) {
      await adapter.serializeLoadOrder(merged, deployed);
    }
  } catch (err) {
    api.sendNotification({
      type: "warning",
      title: "Could not apply the collection's saved plugin order",
      message: getErrorMessageOrDefault(err),
    });
  }
}
