import { unknownToError } from "@vortex/shared";
import { DataInvalid } from "@vortex/shared/errors";

import { log } from "../../logging";
import type { IExtensionApi } from "../../types/IExtensionContext";
import { isInstallationActive } from "../collections/util/selectors";
import { modsForGame } from "../mod_management/selectors";
import type { IRemoveModOptions } from "../mod_management/types/IRemoveModOptions";
import {
  activeProfile,
  lastActiveProfileForGame,
  profileById,
} from "../profile_management/selectors";
import type { IProfile } from "../profile_management/types/IProfile";
import { setFBLoadOrder } from "./actions/loadOrder";
import {
  holdFBLoadOrderForDeploy,
  releaseFBLoadOrderHold,
  setValidationResult,
} from "./actions/session";
import { adoptedLoadOrder, orphansLegacyOrder } from "./adoption";
import type { LoadOrderRegistry } from "./gameSupport";
import { holdAwaitsMods, holdCanRestore, holdIsStale, vortexModIdOf } from "./hold";
import { diffLoadOrder } from "./loadOrderDiff";
import { dropRemovedProfileLoadOrders } from "./profileCleanup";
import { reconcileLoadOrder } from "./reconcile";
import type { NamedLoadOrders } from "./reducers/multiLoadOrder";
import type { IHeldLoadOrder } from "./reducers/session";
import { loadOrderToPersist } from "./resolveLoadOrder";
import { loadOrderForProfile, loadOrderHeldForDeploy, storedNamedLoadOrder } from "./selectors";
import {
  type ILoadOrderEntry,
  type IRegisteredLoadOrder,
  type IValidationResult,
  type LoadOrder,
  LoadOrderValidationError,
} from "./types/types";
import { assertValidationResult, errorHandler } from "./util";

// keyed by profile id
type PrimaryLoadOrders = Record<string, LoadOrder | undefined>;
// keyed by profile id
type Profiles = Record<string, IProfile>;

// A load order the game currently wants managed.
export const isInUse = (gameEntry: IRegisteredLoadOrder): boolean =>
  gameEntry.condition?.() !== false;

// A primary load order is dispatched without an id; community extensions read that payload.
const loadOrderIdForDispatch = (gameEntry: IRegisteredLoadOrder): string | undefined =>
  gameEntry.isPrimary ? undefined : gameEntry.loadOrderId;

function dispatchLoadOrder(
  api: IExtensionApi,
  profileId: string,
  gameEntry: IRegisteredLoadOrder,
  loadOrder: LoadOrder,
): void {
  api.store.dispatch(setFBLoadOrder(profileId, loadOrder, loadOrderIdForDispatch(gameEntry)));
}

function reportError(
  api: IExtensionApi,
  gameEntry: IRegisteredLoadOrder,
  err: unknown,
): Promise<void> {
  return errorHandler(api, gameEntry.gameId, gameEntry, unknownToError(err));
}

// A populated primary order that no load order reads is logged.
function logUnclaimedPrimaryOrder(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  profileId: string,
  gameId: string,
): void {
  if (
    orphansLegacyOrder(registry.entries(gameId), loadOrderForProfile(api.getState(), profileId))
  ) {
    log("error", "no load order continues the existing one", { gameId, profileId });
  }
}

// The order a load order has for a profile. An adopting load order read for the first time starts
// from a copy of the primary order.
function storedLoadOrder(
  api: IExtensionApi,
  profileId: string,
  gameEntry: IRegisteredLoadOrder,
): LoadOrder {
  const state = api.getState();
  if (!gameEntry.isPrimary) {
    const adopted = adoptedLoadOrder(
      gameEntry,
      loadOrderForProfile(state, profileId),
      storedNamedLoadOrder(state, profileId, gameEntry.loadOrderId),
    );
    if (adopted !== undefined) {
      log("info", "load order adopted the existing order", {
        gameId: gameEntry.gameId,
        loadOrderId: gameEntry.loadOrderId,
      });
      dispatchLoadOrder(api, profileId, gameEntry, adopted);
    }
  }
  const stored = loadOrderForProfile(api.getState(), profileId, gameEntry.loadOrderId);
  // the stored order can be dispatched back as it is, and the selector's empty miss is frozen
  return stored.length === 0 ? [] : stored;
}

export async function validateLoadOrder(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  profile: IProfile,
  loadOrder: LoadOrder,
  loadOrderId?: string,
): Promise<IValidationResult> {
  if (profile?.id === undefined) {
    log("error", "failed to validate load order due to undefined profile", loadOrder);
    throw new DataInvalid("invalid profile");
  }
  const gameEntry = registry.find(profile.gameId, loadOrderId);
  if (gameEntry === undefined) {
    log("error", "invalid game entry", { gameId: profile.gameId, loadOrderId });
    throw new DataInvalid("invalid game entry");
  }
  const previousLoadOrder = loadOrderForProfile(api.getState(), profile.id, loadOrderId);
  const validationResult: IValidationResult = await gameEntry.validate(
    previousLoadOrder,
    loadOrder,
  );
  assertValidationResult(validationResult);
  if (validationResult !== undefined) {
    throw new LoadOrderValidationError(validationResult, loadOrder);
  }
  api.store.dispatch(setValidationResult(profile.id, undefined));
  return undefined;
}

// The held order, restored into a load order the game reported, replaces the hold.
function restoreHeldLoadOrder(
  api: IExtensionApi,
  profileId: string,
  gameEntry: IRegisteredLoadOrder,
  held: IHeldLoadOrder,
  fromGame: LoadOrder,
): void {
  const restored = reconcileLoadOrder(
    held.loadOrder,
    fromGame,
    modsForGame(api.getState(), gameEntry.gameId),
  );
  // released before the restored order is dispatched, so the change watcher writes it
  api.store.dispatch(releaseFBLoadOrderHold(profileId, gameEntry.loadOrderId));
  dispatchLoadOrder(api, profileId, gameEntry, restored);
}

// A held order is restored into the first change listing the mods it awaits; other changes while
// held are the game's interim order, neither written nor validated.
async function handleLoadOrderChange(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  profile: IProfile,
  gameEntry: IRegisteredLoadOrder,
  previousLoadOrder: LoadOrder,
  nextLoadOrder: LoadOrder,
): Promise<void> {
  const held = loadOrderHeldForDeploy(api.getState(), profile.id, gameEntry.loadOrderId);
  if (held !== undefined) {
    if (holdAwaitsMods(held) && holdCanRestore(held, nextLoadOrder)) {
      // deferred past the watcher reporting this change; the restored order comes back through it
      await Promise.resolve();
      restoreHeldLoadOrder(api, profile.id, gameEntry, held, nextLoadOrder);
    }
    return;
  }
  const diff = diffLoadOrder(previousLoadOrder, nextLoadOrder);
  const changed =
    diff.added.length > 0 || diff.removed.length > 0 || diff.same.length !== nextLoadOrder.length;
  try {
    if (changed) {
      // the only place a load order change is written to the game
      await gameEntry.serializeLoadOrder(nextLoadOrder, previousLoadOrder);
    }
    await validateLoadOrder(api, registry, profile, nextLoadOrder, gameEntry.loadOrderId);
  } catch (err) {
    return reportError(api, gameEntry, err);
  }
}

// The active profile and its game's load orders in use, unless a collection is installing.
function activeLoadOrders(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
): { profile: IProfile; gameEntries: IRegisteredLoadOrder[] } | undefined {
  const state = api.getState();
  if (isInstallationActive(state)) {
    return undefined;
  }
  const profile = activeProfile(state);
  if (profile?.gameId === undefined) {
    return undefined;
  }
  return { profile, gameEntries: registry.entries(profile.gameId).filter(isInUse) };
}

// Reads every load order of the active profile back from the game, as the game now has it.
async function readActiveLoadOrdersFromGame(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
): Promise<void> {
  const active = activeLoadOrders(api, registry);
  for (const gameEntry of active?.gameEntries ?? []) {
    try {
      dispatchLoadOrder(api, active.profile.id, gameEntry, await gameEntry.deserializeLoadOrder());
    } catch {
      // nop - any errors would've been reported by handleLoadOrderChange.
    }
  }
}

// A load order of one profile, read from the slice that holds it.
type LoadOrderSlot<Slice> = (
  loadOrders: Slice | undefined,
  profileId: string,
  gameEntry: IRegisteredLoadOrder,
) => LoadOrder | undefined;

const primarySlot: LoadOrderSlot<PrimaryLoadOrders> = (loadOrders, profileId) =>
  loadOrders?.[profileId];

const namedSlot: LoadOrderSlot<NamedLoadOrders> = (loadOrders, profileId, gameEntry) =>
  loadOrders?.[profileId]?.[gameEntry.loadOrderId];

// Handles a change to the slice holding the primary load order, or the one holding named orders.
async function onLoadOrdersChanged<Slice>(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  holdsPrimary: boolean,
  slotOf: LoadOrderSlot<Slice>,
  previous: Slice | undefined,
  current: Slice | undefined,
): Promise<void> {
  const active = activeLoadOrders(api, registry);
  const gameEntries = active?.gameEntries.filter((entry) => entry.isPrimary === holdsPrimary);
  for (const gameEntry of gameEntries ?? []) {
    const previousLoadOrder = slotOf(previous, active.profile.id, gameEntry);
    const currentLoadOrder = slotOf(current, active.profile.id, gameEntry);
    // a change to another profile or another load order leaves this one alone
    if (previousLoadOrder === currentLoadOrder || !Array.isArray(currentLoadOrder)) {
      continue;
    }
    await handleLoadOrderChange(
      api,
      registry,
      active.profile,
      gameEntry,
      Array.isArray(previousLoadOrder) ? previousLoadOrder : [],
      currentLoadOrder,
    );
  }
}

async function onProfilesChanged(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  previous: Profiles,
  current: Profiles,
): Promise<void> {
  dropRemovedProfileLoadOrders(api, previous, current);
  const activeProfileId = activeProfile(api.getState())?.id;
  if (activeProfileId === undefined || current?.[activeProfileId] === undefined) {
    return;
  }
  return readActiveLoadOrdersFromGame(api, registry);
}

async function onToolsRunningChanged(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  current: Record<string, unknown>,
): Promise<void> {
  // the user may have changed a load order inside the tool or game that just closed
  if (Object.keys(current ?? {}).length > 0) {
    return;
  }
  return readActiveLoadOrdersFromGame(api, registry);
}

// The load orders of a deployed or purged profile, read back from the game: after a deployment
// the stored order, a held one once the game lists the mods it awaits; after a purge the game's
// order, unless it read back nothing.
async function reconcileProfileLoadOrders(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  profileId: string,
  afterDeploy: boolean,
): Promise<void> {
  const state = api.getState();
  if (isInstallationActive(state)) {
    return;
  }
  const profile = profileById(state, profileId);
  if (profile?.gameId === undefined) {
    // the profile may have been removed while the event was queued
    log("warn", "invalid profile id", profileId);
    return;
  }
  logUnclaimedPrimaryOrder(api, registry, profileId, profile.gameId);
  for (const gameEntry of registry.entries(profile.gameId).filter(isInUse)) {
    try {
      const held = afterDeploy
        ? loadOrderHeldForDeploy(api.getState(), profileId, gameEntry.loadOrderId)
        : undefined;
      const fromGame = await gameEntry.deserializeLoadOrder();
      const mods = modsForGame(api.getState(), gameEntry.gameId);
      if (held !== undefined && (holdCanRestore(held, fromGame) || holdIsStale(held, mods))) {
        restoreHeldLoadOrder(api, profileId, gameEntry, held, fromGame);
        continue;
      }
      const stored = held?.loadOrder ?? storedLoadOrder(api, profileId, gameEntry);
      dispatchLoadOrder(
        api,
        profileId,
        gameEntry,
        afterDeploy
          ? reconcileLoadOrder(stored, fromGame, mods)
          : loadOrderToPersist(stored, fromGame),
      );
    } catch {
      // nop - any errors would've been reported by handleLoadOrderChange.
    }
  }
}

// Holds the profile's load orders in use that list an awaited mod, or every one when none is
// awaited, unless a collection is installing.
function holdLoadOrders(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  profileId: string | undefined,
  awaitedVortexModIds: string[],
): void {
  const state = api.getState();
  const profile = profileById(state, profileId);
  if (profile?.gameId === undefined || isInstallationActive(state)) {
    return;
  }
  const awaits = (entry: ILoadOrderEntry) => awaitedVortexModIds.includes(vortexModIdOf(entry));
  for (const gameEntry of registry.entries(profile.gameId).filter(isInUse)) {
    const loadOrder = loadOrderForProfile(state, profileId, gameEntry.loadOrderId);
    if (loadOrder.length > 0 && (awaitedVortexModIds.length === 0 || loadOrder.some(awaits))) {
      api.store.dispatch(
        holdFBLoadOrderForDeploy(profileId, gameEntry.loadOrderId, loadOrder, awaitedVortexModIds),
      );
    }
  }
}

// A replacement removes the old mod first; its order waits for the game to list the mod again.
function onWillRemoveMods(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  gameId: string,
  vortexModIds: string[],
  removeOptions: IRemoveModOptions | undefined,
): Promise<void> {
  if (removeOptions?.willBeReplaced === true) {
    const profileId = lastActiveProfileForGame(api.getState(), gameId);
    holdLoadOrders(api, registry, profileId, vortexModIds);
  }
  return Promise.resolve();
}

// A purge takes the mods' entries out of the game; their order waits for the deploy.
function onWillPurge(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  profileId: string,
): Promise<void> {
  holdLoadOrders(api, registry, profileId, []);
  return Promise.resolve();
}

// Every did-deploy listener has settled, including a game extension listing deployed mods in its
// file from its own handler, so a hold the deployment's read could not end gets one more read.
async function onModsDidDeploy(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  profileId: string,
): Promise<void> {
  const state = api.getState();
  const profile = profileById(state, profileId);
  if (profile?.gameId === undefined || isInstallationActive(state)) {
    return;
  }
  for (const gameEntry of registry.entries(profile.gameId).filter(isInUse)) {
    const awaiting = loadOrderHeldForDeploy(state, profileId, gameEntry.loadOrderId);
    if (awaiting === undefined || !holdAwaitsMods(awaiting)) {
      continue;
    }
    try {
      const fromGame = await gameEntry.deserializeLoadOrder();
      const held = loadOrderHeldForDeploy(api.getState(), profileId, gameEntry.loadOrderId);
      if (held !== undefined && holdCanRestore(held, fromGame)) {
        restoreHeldLoadOrder(api, profileId, gameEntry, held, fromGame);
      }
    } catch {
      // nop - any errors would've been reported by handleLoadOrderChange.
    }
  }
}

// Reads a load order for the page as it mounts, validated against the stored one.
export async function onStartUp(
  api: IExtensionApi,
  registry: LoadOrderRegistry,
  gameId: string,
  loadOrderId?: string,
): Promise<LoadOrder> {
  const profileId = lastActiveProfileForGame(api.getState(), gameId);
  const gameEntry = registry.find(gameId, loadOrderId);
  if (gameEntry === undefined || profileId === undefined) {
    log("debug", "invalid game entry or invalid profile", { gameId, loadOrderId, profileId });
    return undefined;
  }
  const stored = storedLoadOrder(api, profileId, gameEntry);
  try {
    const loadOrder = await gameEntry.deserializeLoadOrder();
    const validationResult: IValidationResult = await gameEntry.validate(stored, loadOrder);
    assertValidationResult(validationResult);
    if (validationResult !== undefined) {
      throw new LoadOrderValidationError(validationResult, loadOrder);
    }
    return loadOrder;
  } catch (err) {
    await reportError(api, gameEntry, err);
    if (err instanceof LoadOrderValidationError) {
      throw err;
    }
    return undefined;
  }
}

// Keeps every registered load order in step with the game: reads them back after deployments,
// purges, profile changes and closed tools, and writes a changed order to the game.
export function registerLoadOrderHandlers(api: IExtensionApi, registry: LoadOrderRegistry): void {
  api.onStateChange(["session", "base", "toolsRunning"], (_previous, current) => {
    void onToolsRunningChanged(api, registry, current as Record<string, unknown>);
  });
  api.onStateChange(["persistent", "loadOrder"], (previous, current) => {
    void onLoadOrdersChanged(
      api,
      registry,
      true,
      primarySlot,
      previous as PrimaryLoadOrders,
      current as PrimaryLoadOrders,
    );
  });
  api.onStateChange(["persistent", "loadOrders"], (previous, current) => {
    void onLoadOrdersChanged(
      api,
      registry,
      false,
      namedSlot,
      previous as NamedLoadOrders,
      current as NamedLoadOrders,
    );
  });
  api.onStateChange(["persistent", "profiles"], (previous, current) => {
    void onProfilesChanged(api, registry, previous as Profiles, current as Profiles);
  });
  api.onAsync<"will-remove-mods">("will-remove-mods", (gameId, vortexModIds, removeOptions) =>
    onWillRemoveMods(api, registry, gameId, vortexModIds, removeOptions),
  );
  api.onAsync<"will-remove-mod">("will-remove-mod", (gameId, vortexModId, removeOptions) =>
    onWillRemoveMods(api, registry, gameId, [vortexModId], removeOptions),
  );
  api.onAsync<"will-purge">("will-purge", (profileId) => onWillPurge(api, registry, profileId));
  api.onAsync<"did-deploy">("did-deploy", (profileId) =>
    reconcileProfileLoadOrders(api, registry, profileId, true),
  );
  api.onAsync<"did-purge">("did-purge", (profileId) =>
    reconcileProfileLoadOrders(api, registry, profileId, false),
  );
  api.events.on<"mods-did-deploy">("mods-did-deploy", (profileId: string) => {
    void onModsDidDeploy(api, registry, profileId);
  });
}
