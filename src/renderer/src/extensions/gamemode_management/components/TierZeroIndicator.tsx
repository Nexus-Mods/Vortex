import React from "react";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";

export function isTierZeroDomainGame(state: IState, gameId: string): boolean {
  return Object.values(state.persistent.gameMode?.tier0 ?? {}).some(
    (entry) => entry.domain === gameId,
  );
}

/** The support tier badge on a detected-section row. Only Tier 0 exists so far:
 * games managed without a game extension. */
export function TierZeroRowBadge({ gameId }: { gameId: string }) {
  const shown = useSelector((state: IState) => isTierZeroDomainGame(state, gameId));

  if (!shown) {
    return null;
  }

  return <p className="text-xs opacity-80">Tier 0</p>;
}
