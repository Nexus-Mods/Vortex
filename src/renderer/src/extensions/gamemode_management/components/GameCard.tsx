import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { useMainContext } from "@/contexts";
import type { IState } from "@/types/IState";
import type { IButtonBrand } from "@/ui/components/button/Button";
import { Button } from "@/ui/components/button/Button";
import { GameTile } from "@/ui/components/game_tile/GameTile";
import type { IIconSource } from "@/ui/components/icon/Icon";
import { activeGameId } from "@/util/selectors";

import { useGameCardActions } from "../hooks/use_game_card_actions/useGameCardActions.hook";
import { Tiers } from "../tiered/types";
import type { GameSource } from "../types/GameSource";
import type { IGameStored } from "../types/IGameStored";
import { gameArtURL } from "../util/gameArtURL";
import { GameDetailsModal } from "./GameDetailsModal";
import { useSupportTier } from "./TierZeroIndicator";

/**
 * Which of the Games page's three sections the card sits in. One prop rather than a
 * flag each, so a card can't claim to be both added and detected.
 */
export type IGameSection = "added" | "detected" | "supported";

export interface IGameCardProps {
  /**
   * The store the detected-games response matched the game on, named until discovery
   * finds the game and names the store itself.
   */
  detectedStore?: string;
  game: IGameStored;
  section: IGameSection;
  onRefreshGameInfo?: (gameId: string) => PromiseLike<void>;
}

/**
 * A game on the Games page: the tile, plus everything about this particular game that
 * has to come out of the store — its art, which storefront it came from, the actions
 * extensions registered for it, and the details dialog its menu opens.
 */
export const GameCard = ({ detectedStore, game, onRefreshGameInfo, section }: IGameCardProps) => {
  const { t } = useTranslation();
  const { api } = useMainContext();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isActive = useSelector((state: IState) => activeGameId(state) === game.id);
  const supportTier = useSupportTier(game);

  const showDetails = useCallback(() => setDetailsOpen(true), []);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);

  // added games' lead action is an "Open", so they don't record an add origin
  const source: GameSource | undefined =
    section === "detected" ? "detected_list" : section === "supported" ? "all_games" : undefined;

  // Registered actions still know games as managed or unmanaged, the older split of this.
  const { menu, primary } = useGameCardActions(
    game.id,
    section === "added" ? "managed" : "unmanaged",
    showDetails,
    source,
  );
  const name = game.name.replace(/\t/g, " ");
  const discoveredStore = useSelector(
    (state: IState) => state.settings.gameMode.discovered[game.id]?.store,
  );
  // Discovery's store is the copy Vortex will manage, so it wins. A game whose extension
  // isn't installed hasn't been through discovery, which leaves the detected store.
  const store = discoveredStore ?? detectedStore;

  const actions: Record<
    IGameSection,
    { brand: IButtonBrand; icon?: IIconSource; label: string; reveal: boolean }
  > = {
    added: { brand: "neutral", label: t("Open"), reveal: true },
    detected: { brand: "primary", icon: "add", label: t("Add game"), reveal: false },
    supported: { brand: "neutral", icon: "add", label: t("Manual add"), reveal: true },
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
        supportTier={supportTier === Tiers.tier0 ? supportTier : undefined}
        menu={{ actions: menu, label: t("Game options") }}
        name={name}
        primaryAction={
          onPrimary && (
            <Button
              appearance="strong"
              brand={action.brand}
              className="w-full"
              leftIcon={action.icon}
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
