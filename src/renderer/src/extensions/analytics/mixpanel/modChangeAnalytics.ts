import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import { getGame } from "../../gamemode_management/util/getGame";
import type { IMod } from "../../mod_management/types/IMod";
import { nexusGames } from "../../nexus_integration/util";
import { nexusGameId } from "../../nexus_integration/util/convertGameId";
import type { ModAnalyticsIdentity, ModChangeReason } from "./MixpanelEvents";
import { ModsRemovedEvent, ModsStateChangedEvent } from "./MixpanelEvents";
import { makeModAnalyticsIdentity } from "./modAnalyticsIdentity";

/**
 * Resolves the per-mod analytics identity from an installed mod's own attributes, or undefined
 * when it should not be tracked: not a Nexus mod, or missing mod/file id (the collection
 * container and bundled/local mods), matching the gating on the download/install events.
 *
 * Uses the mod's own attributes, not its download record (which may be gone or belong to a
 * different collection). `collection_id` is set only when a caller passes the driving collection.
 */
function resolveModIdentity(
  mod: IMod | undefined,
  collectionId: string | null,
): ModAnalyticsIdentity | undefined {
  const attributes = mod?.attributes ?? {};
  const modId = attributes.modId;
  const fileId = attributes.fileId;
  // Gate on the Nexus identity (as the download/install events do); non-Nexus (bundled/local)
  // mods and the collection container have no modId/fileId and are not tracked.
  if (attributes.source !== "nexus" || modId == null || fileId == null) {
    return undefined;
  }
  // downloadGame is our internal game id; the games cache is keyed by Nexus domain, so convert
  // (skyrimse -> skyrimspecialedition) before matching. NaN when the game/cache can't resolve.
  const domain =
    attributes.downloadGame != null
      ? nexusGameId(getGame(attributes.downloadGame), attributes.downloadGame)
      : undefined;
  const numericGameId = nexusGames().find((game) => game.domain_name === domain)?.id ?? Number.NaN;
  // revision_id is null: the mod's own attributes don't record the parent collection revision.
  return makeModAnalyticsIdentity(
    { numericGameId, modId: modId.toString(), fileId: fileId.toString() },
    collectionId,
    null,
  );
}

/**
 * How long the mod had spent in the prior state before this change, from the game's active-profile
 * timestamps: a disable measures time enabled (enabledTime), an enable measures time disabled
 * (disabledTime). 0 when the relevant timestamp is unknown (e.g. the mod was never in that state).
 */
function priorStateDurationMs(
  state: IState,
  gameId: string,
  modId: string,
  change: "enabled" | "disabled",
): number {
  const profileId = state.settings.profiles.lastActiveProfile?.[gameId];
  const modState =
    profileId != null ? state.persistent.profiles[profileId]?.modState?.[modId] : undefined;
  const since = change === "disabled" ? modState?.enabledTime : modState?.disabledTime;
  return typeof since === "number" && since > 0 ? Math.max(0, Date.now() - since) : 0;
}

/**
 * Emits mods_state_changed for a mod being enabled/disabled. No-op for untracked mods
 * (collection container, bundled/local). Looks the mod up by id so callers only need ids.
 */
export function emitModStateChanged(
  api: IExtensionApi,
  gameId: string,
  modId: string,
  change: "enabled" | "disabled",
  reason: ModChangeReason,
  collectionId: string | null = null,
): void {
  const state = api.getState();
  const mod = state.persistent.mods[gameId]?.[modId];
  const identity = resolveModIdentity(mod, collectionId);
  if (identity === undefined) {
    return;
  }
  api.events.emit(
    "analytics-track-mixpanel-event",
    new ModsStateChangedEvent({
      ...identity,
      change,
      reason,
      duration_ms: priorStateDurationMs(state, gameId, modId, change),
    }),
  );
}

/**
 * Emits mods_removed for a mod. Takes the mod object (the removal handler still has it while
 * the state entry is being torn down). No-op for untracked mods.
 */
export function emitModRemoved(
  api: IExtensionApi,
  mod: IMod,
  reason: ModChangeReason,
  willBeReplaced: boolean,
  collectionId: string | null = null,
): void {
  const identity = resolveModIdentity(mod, collectionId);
  if (identity === undefined) {
    return;
  }
  api.events.emit(
    "analytics-track-mixpanel-event",
    new ModsRemovedEvent({ ...identity, reason, will_be_replaced: willBeReplaced }),
  );
}
