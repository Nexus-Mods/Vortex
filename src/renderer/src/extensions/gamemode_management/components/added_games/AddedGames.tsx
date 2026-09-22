import React from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { Listing } from "@/ui/components/listing/Listing";
import { Picker } from "@/ui/components/picker/Picker";
import { activeGameId } from "@/util/selectors";

import type { IGameStored } from "../../types/IGameStored";
import { GamesGrid } from "../GamesGrid";
import { GamesList } from "../GamesList";
import { Section } from "../section/Section";

interface IAddedGamesProps {
  games: IGameStored[];
  count: string;
  filtering: boolean;
  sortOrder: string;
  onBrowseGameLocation: (gameId: string) => PromiseLike<void>;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
  onSortChange: (order: string) => void;
}

/** The games being managed: the ones a profile has been set up for. */
export const AddedGames = ({
  count,
  filtering,
  games,
  sortOrder,
  onBrowseGameLocation,
  onRefreshGameInfo,
  onSortChange,
}: IAddedGamesProps) => {
  const { t } = useTranslation();

  const discoveredGames = useSelector((state: IState) => state.settings.gameMode.discovered);
  const gameMode = useSelector(activeGameId);
  const layout = useSelector((state: IState) => state.settings.gameMode.pickerLayout || "list");

  return (
    <Section
      actions={
        <Picker
          button={{ appearance: "subdued", size: "sm" }}
          options={[
            { label: t("Name A-Z"), value: "alphabetical" },
            { label: t("Recently used"), value: "recentlyused" },
          ]}
          value={sortOrder}
          onChange={onSortChange}
        />
      }
      count={count}
      description={t("Games you're currently managing")}
      title={t("Added games")}
    >
      <Listing
        entityCount={games.length}
        noResultsMessage={
          filtering
            ? t("Try adjusting your search terms.")
            : t("Add an installed game to start managing its mods.")
        }
        noResultsTitle={filtering ? t("No games found") : t("No games managed yet")}
      >
        {layout === "list" ? (
          <GamesList
            discoveredGames={discoveredGames}
            gameMode={gameMode}
            games={games}
            t={t}
            type="managed"
            onBrowseGameLocation={onBrowseGameLocation}
            onRefreshGameInfo={onRefreshGameInfo}
          />
        ) : (
          <GamesGrid games={games} section="added" onRefreshGameInfo={onRefreshGameInfo} />
        )}
      </Listing>
    </Section>
  );
};
