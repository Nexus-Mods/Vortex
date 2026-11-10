import { GameDomain } from "@vortex/shared";
import { useSelector } from "react-redux";

import { getGame } from "@/extensions/gamemode_management/util/getGame";
import { nexusGameId } from "@/extensions/nexus_integration/util/convertGameId";
import type { IState } from "@/types/IState";
import { activeGameId } from "@/util/selectors";

/** The active game's Nexus Mods domain, for its website pages and API calls; none outside a game. */
export const useGameDomainName = (): GameDomain | undefined => {
  const gameId = useSelector((state: IState) => activeGameId(state));

  if (!gameId) {
    return undefined;
  }

  return GameDomain(nexusGameId(getGame(gameId), gameId));
};
