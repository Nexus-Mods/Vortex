import type { GameDomain } from "@vortex/shared";
import { VortexGameId } from "@vortex/shared";
import { shallowEqual } from "react-redux";
import { createSelector } from "reselect";

import { knownGames } from "@/extensions/gamemode_management/selectors";
import type { IGameStored } from "@/extensions/gamemode_management/types/IGameStored";
import type { IMod } from "@/extensions/mod_management/types/IMod";
import { nexusGameId } from "@/extensions/nexus_integration/util/convertGameId";
import type { IState } from "@/types/IState";
import { activeGameId } from "@/util/selectors";

import {
  downloadKeysOf,
  groupModInstallSources,
} from "../../util/mod_install_state/modInstallGroups";
import type { IModInstallSources } from "../../util/mod_install_state/modInstallState";

const NO_MODS: { [modId: string]: IMod } = {};

/** Looks games' Nexus Mods domains up by id, each once, from the known games. */
const domainLookup = (games: IGameStored[]): IModInstallSources["domainOf"] => {
  const domains = new Map<VortexGameId, GameDomain | undefined>();

  return (id) => {
    if (!domains.has(id)) {
      domains.set(
        id,
        nexusGameId(
          games.find((game) => game.id === id),
          id,
        ),
      );
    }
    return domains.get(id);
  };
};

/** The known games' domains, looked up once each until the games change. */
export const gameDomains = createSelector(knownGames, domainLookup);

/**
 * Each download's key. The same object until a key changes, so a download's progress, which
 * replaces the downloads on every tick, doesn't regroup the mods.
 */
export const downloadKeys = createSelector(
  [(state: IState) => state.persistent.downloads.files, gameDomains],
  downloadKeysOf,
  { memoizeOptions: { resultEqualityCheck: shallowEqual } },
);

/** The active game's mods and downloads by the mod they're of, grouped once per change. */
export const modInstallGroups = createSelector(
  [activeGameId, (state: IState) => state.persistent.mods, downloadKeys, gameDomains],
  (active, modsByGame, keys, domainOf) =>
    active
      ? groupModInstallSources(modsByGame[active] ?? NO_MODS, keys, VortexGameId(active), domainOf)
      : undefined,
);
