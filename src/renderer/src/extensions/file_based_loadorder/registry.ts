import type { ILoadOrderGameInfo, IRegisteredLoadOrder } from "./types/types";
import { DEFAULT_LOAD_ORDER_ID } from "./types/types";

// Ids are persisted as state keys, so they stay to characters no key separator uses.
const LOAD_ORDER_ID = /^[A-Za-z0-9_-]+$/;

export const RegistrationRejection = {
  InvalidId: "invalid-id",
  Duplicate: "duplicate",
  AdopterWithoutId: "adopter-without-id",
  SecondAdopter: "second-adopter",
} as const;
export type RegistrationRejection =
  (typeof RegistrationRejection)[keyof typeof RegistrationRejection];

export const isPrimaryLoadOrderId = (loadOrderId: string | undefined): boolean =>
  loadOrderId === undefined || loadOrderId === DEFAULT_LOAD_ORDER_ID;

export function resolveEntry(
  gameEntry: ILoadOrderGameInfo,
  isContributed: boolean,
): IRegisteredLoadOrder {
  return {
    ...gameEntry,
    isContributed,
    loadOrderId: gameEntry.loadOrderId ?? DEFAULT_LOAD_ORDER_ID,
    isPrimary: isPrimaryLoadOrderId(gameEntry.loadOrderId),
  };
}

export function registrationRejection(
  registered: readonly IRegisteredLoadOrder[],
  gameEntry: ILoadOrderGameInfo,
): RegistrationRejection | undefined {
  const loadOrderId = gameEntry.loadOrderId ?? DEFAULT_LOAD_ORDER_ID;
  if (!LOAD_ORDER_ID.test(loadOrderId)) {
    return RegistrationRejection.InvalidId;
  }
  const sameGame = registered.filter((entry) => entry.gameId === gameEntry.gameId);
  if (sameGame.some((entry) => entry.loadOrderId === loadOrderId)) {
    return RegistrationRejection.Duplicate;
  }
  if (gameEntry.adoptsLegacyOrder === true) {
    if (gameEntry.loadOrderId === undefined) {
      return RegistrationRejection.AdopterWithoutId;
    }
    if (sameGame.some((entry) => entry.adoptsLegacyOrder === true)) {
      return RegistrationRejection.SecondAdopter;
    }
  }
  return undefined;
}

// The game's load orders as its tabs list them: primary first, then by priority,
// then in registration order.
export function entriesForGame(
  registered: readonly IRegisteredLoadOrder[],
  gameId: string,
): IRegisteredLoadOrder[] {
  const rank = (entry: IRegisteredLoadOrder) =>
    entry.isPrimary ? Number.NEGATIVE_INFINITY : (entry.priority ?? Number.POSITIVE_INFINITY);
  return registered
    .filter((entry) => entry.gameId === gameId)
    .sort((lhs, rhs) => (rank(lhs) === rank(rhs) ? 0 : rank(lhs) < rank(rhs) ? -1 : 1));
}

// Without an id, the game's first listed load order: its primary when it has one.
export function findEntry(
  registered: readonly IRegisteredLoadOrder[],
  gameId: string,
  loadOrderId?: string,
): IRegisteredLoadOrder | undefined {
  const entries = entriesForGame(registered, gameId);
  return loadOrderId === undefined
    ? entries[0]
    : entries.find((entry) => entry.loadOrderId === loadOrderId);
}
