import type PromiseBB from "bluebird";
import type { TFunction } from "i18next";
import React from "react";
import { ListGroup } from "react-bootstrap";

import type { IDiscoveryResult } from "../types/IDiscoveryResult";
import type { IGameStored } from "../types/IGameStored";
import GameRow from "../views/GameRow";

interface IGamesListProps {
  t: TFunction;
  games: IGameStored[];
  type: string;
  gameMode: string;
  discoveredGames: { [id: string]: IDiscoveryResult };
  container: HTMLElement | null;
  getBounds: () => ClientRect;
  onRefreshGameInfo: (gameId: string) => PromiseBB<void>;
  onBrowseGameLocation: (gameId: string) => PromiseBB<void>;
}

export const GamesList = ({
  t,
  games,
  type,
  gameMode,
  discoveredGames,
  container,
  getBounds,
  onRefreshGameInfo,
  onBrowseGameLocation,
}: IGamesListProps) => (
  <ListGroup>
    {games.map((game) => (
      <GameRow
        active={game.id === gameMode}
        container={container}
        discovery={discoveredGames[game.id]}
        game={game}
        getBounds={getBounds}
        key={game.id}
        t={t}
        type={type}
        onBrowseGameLocation={onBrowseGameLocation}
        onRefreshGameInfo={onRefreshGameInfo}
      />
    ))}
  </ListGroup>
);
