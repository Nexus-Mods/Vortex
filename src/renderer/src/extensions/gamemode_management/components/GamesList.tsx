import type { TFunction } from "i18next";
import React from "react";
import { ListGroup } from "react-bootstrap";

import type { GameSource } from "../types/GameSource";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import type { IGameStored } from "../types/IGameStored";
import GameRow from "../views/GameRow";
import type { IGameSection } from "./GameCard";

interface IGamesListProps {
  t: TFunction;
  games: IGameStored[];
  type: string;
  gameMode: string;
  discoveredGames: { [id: string]: IDiscoveryResult };
  /** The store each game was detected on, by internal id, for its row to name. */
  detectedStores?: Record<string, string>;
  /** Which Games page list the rows are in, recorded for the app_game_manage event. */
  source?: GameSource;
  /** The Games page section the rows are in, for their analytics. */
  section: IGameSection;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
  onBrowseGameLocation: (gameId: string) => PromiseLike<void>;
}

export const GamesList = ({
  t,
  games,
  type,
  gameMode,
  discoveredGames,
  detectedStores,
  source,
  section,
  onRefreshGameInfo,
  onBrowseGameLocation,
}: IGamesListProps) => (
  <ListGroup>
    {games.map((game) => (
      <GameRow
        active={game.id === gameMode}
        detectedStore={detectedStores?.[game.id]}
        discovery={discoveredGames[game.id]}
        game={game}
        key={game.id}
        section={section}
        source={source}
        t={t}
        type={type}
        onBrowseGameLocation={onBrowseGameLocation}
        onRefreshGameInfo={onRefreshGameInfo}
      />
    ))}
  </ListGroup>
);
