import { GameDomain } from "@vortex/shared";
import React from "react";
import { useSelector } from "react-redux";

import { useFlag } from "@/contexts/FlagsContext";
import type { IState } from "@/types/IState";

import { domainToNumericGameId } from "../../nexus_integration/util";
import { nexusGameId } from "../../nexus_integration/util/convertGameId";
import { supportTier } from "../tiered/supportTier";
import { Tiers, type Tier } from "../tiered/types";
import type { IGameStored } from "../types/IGameStored";

/** The game's support tier, undefined while the Tier 0 flag gates it off. */
export function useSupportTier(game: IGameStored): Tier | undefined {
  const tierZeroAllowed = useFlag("vortex-tier-0-game-support") !== undefined;

  return useSelector((state: IState) => {
    if (!tierZeroAllowed) {
      return undefined;
    }
    const numericId = domainToNumericGameId(GameDomain(nexusGameId(game)));
    return numericId === undefined ? undefined : supportTier(state, numericId);
  });
}

/** The support tier badge on a Games page row. Only Tier 0 is indicated for now:
 * games managed without a game extension. */
export function TierZeroRowBadge({ game }: { game: IGameStored }) {
  const tier = useSupportTier(game);

  if (tier !== Tiers.tier0) {
    return null;
  }

  return <p className="text-xs opacity-80">{tier}</p>;
}
