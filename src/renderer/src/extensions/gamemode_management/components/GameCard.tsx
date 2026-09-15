import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useMainContext } from "@/contexts";
import type { IState } from "@/types/IState";
import { GameTile } from "@/ui/components/game_tile/GameTile";
import { activeGameId } from "@/util/selectors";

import { useGameCardActions } from "../hooks/use_game_card_actions/useGameCardActions.hook";
import type { IGameStored } from "../types/IGameStored";
import { gameArtURL } from "../util/gameArtURL";
import { GameDetailsModal } from "./GameDetailsModal";

export interface IGameCardProps {
  className?: string;
  game: IGameStored;
  /** Which set of registered actions the game gets: `managed` or `unmanaged`. */
  type: string;
  onRefreshGameInfo?: (gameId: string) => PromiseLike<void>;
}

/**
 * How many mods the game's last active profile has switched on. A game nothing has been
 * installed for has no count rather than a zero, there being no story in "0 active
 * mods" — same as the classic tile.
 */
const useActiveModCount = (gameId: string | undefined): number | undefined =>
  useSelector((state: IState) => {
    if (gameId === undefined) {
      return undefined;
    }

    const profileId = state.settings.profiles.lastActiveProfile?.[gameId];
    const profile = profileId !== undefined ? state.persistent.profiles[profileId] : undefined;

    if (profile === undefined) {
      return undefined;
    }

    const mods = state.persistent.mods[gameId] ?? {};
    const modState = profile.modState ?? {};

    return Object.keys(modState).filter((id) => modState[id].enabled && mods[id] !== undefined)
      .length;
  });

/**
 * A game on the Games page: the tile, plus everything about this particular game that
 * has to come out of the store — its art, what its profile has enabled, the actions
 * extensions registered for it, and the details dialog its menu opens.
 */
export const GameCard = ({ className, game, onRefreshGameInfo, type }: IGameCardProps) => {
  const { t } = useTranslation();
  const { api } = useMainContext();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const showDetails = useCallback(() => setDetailsOpen(true), []);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);

  const { menu, primary } = useGameCardActions(game.id, type, showDetails);
  const name = game.name.replace(/\t/g, " ");

  // Only a managed game counts its mods: an unmanaged one that kept a profile from
  // before still has a count, and the design doesn't want it there.
  const modCount = useActiveModCount(type === "managed" ? game.id : undefined);

  const isActive = useSelector((state: IState) => activeGameId(state) === game.id);

  // The active game has nothing to activate — that action rules itself out for the game
  // it would be a no-op on — so its tile leads with the way into the game instead.
  // Opening a per-game page is what moves the app to that game; the spine follows.
  const view = { label: t("View"), onClick: () => api.events.emit("show-main-page", "Mods") };

  // The card calls adding a game "Add game", where the registry keeps the "Manage" the
  // classic surfaces still show.
  const primaryAction = isActive
    ? view
    : primary && {
        label: type === "unmanaged" ? t("Add game") : primary.label,
        onClick: primary.onClick,
      };

  return (
    <>
      <GameTile
        className={className}
        contributedBy={game.contributed}
        imageUrl={gameArtURL(game)}
        menu={{ actions: menu, label: t("Game options") }}
        modCount={modCount}
        name={name}
        primaryAction={primaryAction}
      />

      {detailsOpen && (
        <GameDetailsModal
          isOpen
          gameId={game.id}
          gameName={name}
          onClose={closeDetails}
          onRefreshGameInfo={onRefreshGameInfo}
        />
      )}
    </>
  );
};
