import React, { forwardRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { IState } from "@/types/IState";
import { Listing } from "@/ui/components/listing/Listing";
import { Pagination } from "@/ui/components/pagination/Pagination";
import { Picker } from "@/ui/components/picker/Picker";
import { activeGameId } from "@/util/selectors";

import type { IGameStored } from "../../types/IGameStored";
import { GamesGrid } from "../GamesGrid";
import { GamesList } from "../GamesList";
import { NoGamesFound } from "../NoGamesFound";
import { Section } from "../section/Section";

/** The catalogue runs to hundreds of games, so it's shown this many at a time. */
const PAGE_SIZE = 49;

interface ISupportedGamesProps {
  games: IGameStored[];
  count: string;
  filterValue: string;
  sortOrder: string;
  onBrowseGameLocation: (gameId: string) => PromiseLike<void>;
  onPageChange: () => void;
  onRefreshGameInfo: (gameId: string) => PromiseLike<void>;
  onSortChange: (order: string) => void;
}

/** Every game Vortex supports, whether or not it's installed. */
export const SupportedGames = forwardRef<HTMLDivElement, ISupportedGamesProps>(
  (
    {
      count,
      filterValue,
      games,
      sortOrder,
      onBrowseGameLocation,
      onPageChange,
      onRefreshGameInfo,
      onSortChange,
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [page, setPage] = useState(1);

    const discoveredGames = useSelector((state: IState) => state.settings.gameMode.discovered);
    const gameMode = useSelector(activeGameId);
    const layout = useSelector((state: IState) => state.settings.gameMode.pickerLayout || "list");

    // A new search or order rebuilds the list under the cursor, so the reader goes back
    // to the start rather than landing on a page that no longer holds what they saw.
    useEffect(() => setPage(1), [filterValue, sortOrder]);

    // Clamped as well, so filtering down to fewer pages can't strand the view past the end.
    const pageCount = Math.max(1, Math.ceil(games.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const paged = games.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    return (
      <Section
        actions={
          <Picker
            button={{ appearance: "subdued", size: "sm" }}
            options={[
              { label: t("Most Popular"), value: "popular" },
              { label: t("Name A-Z"), value: "alphabetical" },
              { label: t("Most Recent"), value: "recent" },
            ]}
            value={sortOrder}
            onChange={onSortChange}
          />
        }
        count={count}
        description={t("Game not detected? Add your game manually.")}
        ref={ref}
        title={t("All supported games")}
      >
        <div className="space-y-6">
          <Listing
            customNoResults={<NoGamesFound className="py-16" t={t} />}
            entityCount={games.length}
          >
            {layout === "list" ? (
              <GamesList
                discoveredGames={discoveredGames}
                gameMode={gameMode}
                games={paged}
                t={t}
                type="unmanaged"
                onBrowseGameLocation={onBrowseGameLocation}
                onRefreshGameInfo={onRefreshGameInfo}
              />
            ) : (
              <GamesGrid games={paged} section="supported" onRefreshGameInfo={onRefreshGameInfo} />
            )}
          </Listing>

          {!!games.length && currentPage === pageCount && <NoGamesFound className="py-6" t={t} />}

          <Pagination
            currentPage={currentPage}
            recordsPerPage={PAGE_SIZE}
            totalRecords={games.length}
            onPaginationUpdate={(next) => {
              setPage(next);
              onPageChange();
            }}
          />
        </div>
      </Section>
    );
  },
);

SupportedGames.displayName = "SupportedGames";
