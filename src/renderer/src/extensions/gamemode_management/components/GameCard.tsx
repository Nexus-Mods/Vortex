import { mdiPlus } from "@mdi/js";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useMainContext } from "@/contexts";
import type { IState } from "@/types/IState";
import type { IButtonBrand } from "@/ui/components/button/Button";
import { Button } from "@/ui/components/button/Button";
import { GameTile } from "@/ui/components/game_tile/GameTile";
import { activeGameId } from "@/util/selectors";

import { useGameCardActions } from "../hooks/use_game_card_actions/useGameCardActions.hook";
import type { IGameStored } from "../types/IGameStored";
import { gameArtURL } from "../util/gameArtURL";
import { GameDetailsModal } from "./GameDetailsModal";

/**
 * Which of the Games page's three sections the card sits in. One prop rather than a
 * flag each, so a card can't claim to be both added and detected.
 */
export type IGameSection = "added" | "detected" | "supported";

export interface IGameCardProps {
  game: IGameStored;
  section: IGameSection;
  onRefreshGameInfo?: (gameId: string) => PromiseLike<void>;
}

/**
 * A game on the Games page: the tile, plus everything about this particular game that
 * has to come out of the store — its art, which storefront it came from, the actions
 * extensions registered for it, and the details dialog its menu opens.
 */
export const GameCard = ({ game, onRefreshGameInfo, section }: IGameCardProps) => {
  const { t } = useTranslation();
  const { api } = useMainContext();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isActive = useSelector((state: IState) => activeGameId(state) === game.id);

  const showDetails = useCallback(() => setDetailsOpen(true), []);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);

  // Registered actions still know games as managed or unmanaged, the older split of this.
  const { menu, primary } = useGameCardActions(
    game.id,
    section === "added" ? "managed" : "unmanaged",
    showDetails,
  );
  const name = game.name.replace(/\t/g, " ");
  const store = useSelector((state: IState) => state.settings.gameMode.discovered[game.id]?.store);

  const actions: Record<
    IGameSection,
    { brand: IButtonBrand; iconPath?: string; label: string; reveal: boolean }
  > = {
    added: { brand: "neutral", label: t("Open"), reveal: true },
    detected: { brand: "primary", iconPath: mdiPlus, label: t("Add game"), reveal: false },
    supported: { brand: "neutral", iconPath: mdiPlus, label: t("Manual add"), reveal: true },
  };

  const action = actions[section];

  // Activate is conditioned away for the game already in play, so its tile opens the
  // game's mods rather than leading with nothing.
  const openMods = useCallback(() => api.events.emit("show-main-page", "Mods"), [api]);
  const onPrimary = isActive ? openMods : primary?.onClick;

  return (
    <>
      <GameTile
        highlighted={section === "detected"}
        imageUrl={gameArtURL(game)}
        menu={{ actions: menu, label: t("Game options") }}
        name={name}
        primaryAction={
          onPrimary && (
            <Button
              appearance="strong"
              brand={action.brand}
              className="w-full"
              leftIconPath={action.iconPath}
              onClick={onPrimary}
            >
              {action.label}
            </Button>
          )
        }
        revealPrimaryAction={action.reveal}
        store={store}
        supportedBy={game.contributed}
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
