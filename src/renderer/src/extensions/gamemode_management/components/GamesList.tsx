import type { TFunction } from "i18next";
import React from "react";
import { ListGroup } from "react-bootstrap";

import type { GameSource } from "../types/GameSource";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import type { IGameStored } from "../types/IGameStored";
import GameRow from "../views/GameRow";

interface IGamesListProps {
  t: TFunction;
  games: IGameStored[];
  type: string;
  gameMode: string;
  discoveredGames: { [id: string]: IDiscoveryResult };
  /** Which Games page list the rows are in, recorded for the app_game_manage event. */
  source?: GameSource;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
  onBrowseGameLocation: (gameId: string) => PromiseLike<void>;
}

export const GamesList = ({
  t,
  games,
  type,
  gameMode,
  discoveredGames,
  source,
  onRefreshGameInfo,
  onBrowseGameLocation,
}: IGamesListProps) => (
  <ListGroup>
    {games.map((game) => (
      <GameRow
        active={game.id === gameMode}
        discovery={discoveredGames[game.id]}
        game={game}
        key={game.id}
        source={source}
        t={t}
        type={type}
        onBrowseGameLocation={onBrowseGameLocation}
        onRefreshGameInfo={onRefreshGameInfo}
      />
    ))}
  </ListGroup>
);
