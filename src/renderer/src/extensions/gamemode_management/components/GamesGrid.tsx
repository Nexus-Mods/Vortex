import React from "react";

import type { IGameStored } from "../types/IGameStored";
import type { IGameSection } from "./GameCard";
import { GameCard } from "./GameCard";

interface IGamesGridProps {
  games: IGameStored[];
  section: IGameSection;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
}

export const GamesGrid = ({ games, section, onRefreshGameInfo }: IGamesGridProps) => (
  <div className="grid-games">
    {games.map((game) => (
      <GameCard
        game={game}
        key={game.id + "_" + (game.contributed ?? "official")}
        section={section}
        onRefreshGameInfo={onRefreshGameInfo}
      />
    ))}
  </div>
);
