import type { IGameListEntry } from "@nexusmods/nexus-api";
import { GameUid, NexusGameDomain, NexusGameId, VortexError, VortexGameId } from "@vortex/shared";
import type { RecordedGameUid } from "@vortex/shared";

import type { IGameStored, IGameUidRetirement, ITierZeroGame } from "@/types/IState";

import { tierZeroGameId } from "./tiered/tierZeroGameId";
import type { IDiscoveryResult } from "./types/IDiscoveryResult";

/**
 * The collections the game queries join over. Every query takes them as an argument, so
 * nothing here reads Redux or a module singleton.
 */
export interface IGameData {
  /** `session.gameMode.known` */
  known: readonly IGameStored[];

  /** `persistent.gameMode.tier0` */
  tier0: Readonly<Record<NexusGameId, ITierZeroGame>>;

  /** `persistent.gameMode.gameUidHistory`, oldest first */
  gameUidHistory: readonly IGameUidRetirement[];

  /** The Nexus Mods games list, which links every `NexusGameId` to its domain */
  nexusGames: readonly IGameListEntry[];
}

interface IGameUidResolution {
  /** the newest entry per retired uid */
  next: Map<GameUid, GameUid>;
  /** chains by starting uid */
  chains: Map<string, readonly GameUid[]>;
}

/**
 * Keyed by the history array, which an append replaces, so a resolution is recomputed only when
 * the history changes.
 */
const resolutions = new WeakMap<readonly IGameUidRetirement[], IGameUidResolution>();

function resolution(history: readonly IGameUidRetirement[]): IGameUidResolution {
  let res = resolutions.get(history);
  if (res === undefined) {
    // later entries overwrite earlier ones: the newest entry for a retired uid wins
    res = {
      next: new Map(history.map((entry) => [entry.retired, entry.current])),
      chains: new Map(),
    };
    resolutions.set(history, res);
  }
  return res;
}

/**
 * The uids a stored uid has been retired through, oldest first, starting with the stored uid
 * itself and ending with its current uid. For logs and diagnostics.
 *
 * @throws {@link VortexError} with kind `data-invalid` if the history loops. A loop means the
 * history is corrupt, and any uid picked from it could be wrong, so no answer is returned.
 *
 * This and {@link currentGameUid} are the only way from a {@link RecordedGameUid} to a
 * {@link GameUid}.
 */
export function gameUidChain(
  data: Pick<IGameData, "gameUidHistory">,
  uid: RecordedGameUid,
): readonly GameUid[] {
  const res = resolution(data.gameUidHistory);
  const cached = res.chains.get(uid);
  if (cached !== undefined) {
    return cached;
  }

  const chain: GameUid[] = [GameUid(uid)];
  const visited = new Set<GameUid>(chain);
  for (let next = res.next.get(chain[0]); next !== undefined; next = res.next.get(next)) {
    if (visited.has(next)) {
      throw new VortexError(
        `The game uid history loops: ${[...chain, next].join(" -> ")} (resolving ${uid})`,
        { kind: "data-invalid", field: "gameUidHistory" },
      );
    }
    visited.add(next);
    chain.push(next);
  }

  res.chains.set(uid, chain);
  return chain;
}

/**
 * The current uid of a stored uid, which the catalogue may since have retired. A uid without a
 * history entry is its own current uid.
 *
 * @throws {@link VortexError} with kind `data-invalid` if the history loops, see
 * {@link gameUidChain}.
 */
export function currentGameUid(
  data: Pick<IGameData, "gameUidHistory">,
  uid: RecordedGameUid,
): GameUid {
  const chain = gameUidChain(data, uid);
  return chain[chain.length - 1];
}

/**
 * Several games can share a domain. With the discovery results the one that is installed is
 * preferred.
 */
type Discovered = { discovered?: Readonly<Record<VortexGameId, IDiscoveryResult>> };

/** What to look a game up by. Every kind is its own brand, none stands in for another. */
export type GameQuery =
  | { vortexGameId: VortexGameId }
  | ({ gameDomain: NexusGameDomain } & Discovered)
  | ({ gameId: NexusGameId } & Discovered);

/**
 * Find the game for an id. `undefined` means nothing known matches.
 *
 * A domain and a `NexusGameId` are the Nexus Mods game a game is for, which is stored on the game
 * as `nexus`. A game without one is never found by either.
 */
export function findGame(
  data: Pick<IGameData, "known">,
  query: GameQuery,
): IGameStored | undefined {
  if ("vortexGameId" in query) {
    return data.known.find((game) => game.id === query.vortexGameId);
  } else if ("gameDomain" in query) {
    const { gameDomain, discovered } = query;

    return preferInstalled(
      data.known.filter((game) => game.nexus?.gameDomain === gameDomain),
      discovered,
    );
  } else if ("gameId" in query) {
    const { gameId, discovered } = query;

    return preferInstalled(
      data.known.filter((game) => game.nexus?.gameId === gameId),
      discovered,
    );
  } else {
    return unsupportedQuery(query);
  }
}

/** The installed one of the games, else the first. */
function preferInstalled(
  games: IGameStored[],
  discovered: Discovered["discovered"],
): IGameStored | undefined {
  const installed = games.find((game) => discovered?.[VortexGameId(game.id)]?.path !== undefined);

  return installed ?? games[0];
}

/**
 * The Nexus Mods game a game is for, `undefined` when nothing known says. A Tier 0 game
 * carries its own entry. Otherwise `declared`, the domain the game says it belongs to, is
 * looked up in the Nexus Mods games list, which is empty until it has loaded.
 *
 * `declared` is passed in because this is also asked while the game is being stored, when
 * it isn't in `data.known` yet.
 */
export function nexusGameData(
  data: Pick<IGameData, "nexusGames" | "tier0">,
  vortexGameId: VortexGameId,
  declared?: NexusGameDomain,
): { gameId: NexusGameId; gameDomain: NexusGameDomain } | undefined {
  const tierZero = Object.values(data.tier0).find(
    (entry) => tierZeroGameId(entry.gameId) === vortexGameId,
  );

  if (tierZero !== undefined) {
    return { gameId: tierZero.gameId, gameDomain: tierZero.domain };
  }

  if (declared === undefined) {
    return undefined;
  }

  const listed = data.nexusGames.find((entry) => entry.domain_name === declared);
  return listed === undefined
    ? undefined
    : { gameId: NexusGameId(listed.id), gameDomain: declared };
}

/**
 * What to look up the game a stored string names by, where it may be either a Vortex game id or,
 * for a game no extension registers, a Nexus Mods domain, as a mod's `downloadGame` is kept.
 * Branded by what the data says it is: a known game's id first, else a domain the site lists.
 * `undefined` where it's neither.
 */
export function storedGameQuery(
  data: Pick<IGameData, "known" | "nexusGames" | "tier0">,
  stored: string,
): { vortexGameId: VortexGameId } | { gameDomain: NexusGameDomain } | undefined {
  const game = data.known.find(({ id }) => id === stored);
  if (game !== undefined) {
    return { vortexGameId: VortexGameId(game.id) };
  }

  const tierZero = Object.values(data.tier0).find(({ domain }) => domain === stored);
  if (tierZero !== undefined) {
    return { gameDomain: tierZero.domain };
  }

  const listed = data.nexusGames.find(({ domain_name }) => domain_name === stored);
  return listed === undefined ? undefined : { gameDomain: NexusGameDomain(listed.domain_name) };
}

function unsupportedQuery(query: unknown): never {
  throw new VortexError(`Unhandled game query: ${JSON.stringify(query)}`, {
    kind: "argument-invalid",
    argument: "query",
  });
}

/**
 * Convert an id to the id of another kind. `undefined` means nothing known matches, the
 * answer is never a guess.
 *
 * - `vortexGameId` is the id of a registered game, so it is `findGame`'s game.
 * - `gameDomain` and `gameId` are the Nexus Mods game, which a registered game stores as
 *   `nexus`. Between the two, and from a `NexusGameId` to a domain, the data answers without a
 *   registered game: the Tier 0 entry managed under it, else the Nexus Mods games list.
 *
 * Converting an id to its own kind is a type error, there is nothing to look up.
 */
export function convertId(
  data: IGameData,
  query: Exclude<GameQuery, { vortexGameId: VortexGameId }>,
  to: "vortexGameId",
): VortexGameId | undefined;
export function convertId(
  data: IGameData,
  query: Exclude<GameQuery, { gameDomain: NexusGameDomain }>,
  to: "gameDomain",
): NexusGameDomain | undefined;
export function convertId(
  data: IGameData,
  query: Exclude<GameQuery, { gameId: NexusGameId }>,
  to: "gameId",
): NexusGameId | undefined;
export function convertId(
  data: IGameData,
  query: GameQuery,
  to: "vortexGameId" | "gameDomain" | "gameId",
): VortexGameId | NexusGameDomain | NexusGameId | undefined {
  if (to === "vortexGameId") {
    const game = findGame(data, query);
    return game === undefined ? undefined : VortexGameId(game.id);
  }

  if (to === "gameId") {
    if ("vortexGameId" in query) {
      return findGame(data, query)?.nexus?.gameId;
    } else if ("gameDomain" in query) {
      const { gameDomain } = query;

      const tierZero = Object.values(data.tier0).find((entry) => entry.domain === gameDomain);
      if (tierZero !== undefined) {
        return tierZero.gameId;
      }

      const listed = data.nexusGames.find((entry) => entry.domain_name === gameDomain);
      return listed === undefined ? undefined : NexusGameId(listed.id);
    } else {
      return unsupportedQuery(query);
    }
  }

  if ("vortexGameId" in query) {
    return findGame(data, query)?.nexus?.gameDomain;
  } else if ("gameId" in query) {
    const tierZero = data.tier0[query.gameId];
    if (tierZero !== undefined) {
      return tierZero.domain;
    }

    const listed = data.nexusGames.find((entry) => entry.id === query.gameId);
    return listed === undefined ? undefined : NexusGameDomain(listed.domain_name);
  } else {
    return unsupportedQuery(query);
  }
}
