import type { IExtensionApi } from "../../../types/IExtensionContext";
import { discoveryByGame } from "../../gamemode_management/selectors";
import { supportTier } from "../../gamemode_management/tiered/supportTier";
import type { GameSource } from "../../gamemode_management/types/GameSource";
import { getGame } from "../../gamemode_management/util/getGame";
import {
  AppGameActivatedEvent,
  AppGameManagedEvent,
  AppGameUnmanagedEvent,
} from "./MixpanelEvents";
import { numericNexusGameId } from "./numericGameId";

/**
 * Emits app_game_manage for a game managed for the first time, with its support extension version,
 * the store it was installed from, whether its folder was found automatically or set by hand,
 * and which Games page list it was picked from.
 */
export function emitGameManaged(api: IExtensionApi, gameId: string): void {
  const state = api.getState();
  const numericId = numericNexusGameId(gameId);
  const discovery = discoveryByGame(state, gameId);
  // The tile click recorded the list it came from keyed by game id, so a stale origin
  // can't leak into a different game. The event only fires on the add that created the
  // first profile, so the origin never needs clearing.
  const origin = state.session?.gameMode?.gameAddOrigin;
  const gameSource: GameSource | null = origin?.gameId === gameId ? origin.source : null;
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameManagedEvent({
      game_id: numericId,
      support_tier: numericId === null ? undefined : supportTier(state, numericId),
      extension_version: getGame(gameId)?.version ?? "",
      game_store: discovery?.store ?? null,
      discovery_method: discovery?.pathSetManually ? "manual" : "automatic",
      game_source: gameSource,
    }),
  );
}

/** Emits app_game_unmanage for a game the user stopped managing, with the store it was
 * installed from. Runs before the Tier 0 teardown removes the tier0 state, so the tier still
 * resolves here; unmanaging leaves the discovery in place, so the store does too. */
export function emitGameUnmanaged(api: IExtensionApi, gameId: string): void {
  const state = api.getState();
  const numericId = numericNexusGameId(gameId);
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameUnmanagedEvent({
      game_id: numericId,
      game_store: discoveryByGame(state, gameId)?.store ?? null,
      support_tier: numericId === null ? undefined : supportTier(state, numericId),
    }),
  );
}

/** Emits app_game_activate for a switch that made another game the active one, with the store
 * it was installed from. game_id is sent rather than left to the super property, which the same
 * switch is still updating. */
export function emitGameActivated(api: IExtensionApi, gameId: string): void {
  const state = api.getState();
  const numericId = numericNexusGameId(gameId);
  api.events.emit(
    "analytics-track-mixpanel-event",
    new AppGameActivatedEvent({
      game_id: numericId,
      game_store: discoveryByGame(state, gameId)?.store ?? null,
      support_tier: numericId === null ? undefined : supportTier(state, numericId),
    }),
  );
}
