import React, { type KeyboardEvent, type RefObject, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { Listing } from "@/ui/components/listing/Listing";
import { Pagination } from "@/ui/components/pagination/Pagination";
import { hasModifierKey } from "@/ui/utils/hasModifierKey";
import { rovingFocus } from "@/ui/utils/roving_focus/rovingFocus";
import { PageScroll } from "@/views/components/Page/PageScroll";

import { MAX_PAGES, MODS_PER_PAGE } from "../../../hooks/use_mod_search/useModSearch.hook";
import { ModCard } from "../mod_card/ModCard";
import { ModCardSkeleton } from "../mod_card/ModCard.skeleton";

/** The tabbable controls a details pane can take focus at, first in order. */
const TABBABLE =
  'button:not([disabled]):not([tabindex="-1"]), [href], [tabindex]:not([tabindex="-1"])';

interface IModListProps {
  /** The page's mods, in order. */
  mods: ModSummary[];
  /** The id of the mod the details pane shows, which may be on another page. */
  activeModId: string | undefined;
  /** Shows another mod in the details pane, by id. */
  onSelectMod: (id: string) => void;
  /** The page showing, from 1. */
  currentPage: number;
  /** Moves to another page. */
  onPageChange: (page: number) => void;
  /** How many mods the search found, over every page. */
  totalCount: number;
  /** Whether a page is loading. */
  isLoading: boolean;
  /** Whether the page failed to load. */
  isError: boolean;
  /** Asks for the page again, after it failed. */
  onRetry: () => void;
  /** The details pane, for Right to move focus into. */
  detailsRef: RefObject<HTMLDivElement>;
}

/**
 * Browse's list of mods, with pagination that stays through a failed page, which offers to try
 * again. One Tab stop, the open mod or else the first; Up, Down, Home and End pick a mod, and
 * Right moves focus into the details.
 */
export const ModList = ({
  mods,
  activeModId,
  onSelectMod,
  detailsRef,
  currentPage,
  onPageChange,
  totalCount,
  isLoading,
  isError,
  onRetry,
}: IModListProps) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const tabStop = mods.some((mod) => mod.id === activeModId) ? activeModId : mods[0]?.id;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isOnCard = rovingFocus(event, {
      orientation: "vertical",
      itemSelector: "[data-mod-card]",
      onMove: (index) => onSelectMod(mods[index].id),
    });

    if (isOnCard || event.key !== "ArrowRight" || hasModifierKey(event)) {
      return;
    }

    const fromCard =
      event.target instanceof HTMLElement && !!event.target.closest("[data-mod-card]");
    const target = detailsRef.current?.querySelector<HTMLElement>(TABBABLE);

    if (fromCard && target) {
      event.preventDefault();
      target.focus();
    }
  };

  return (
    <div className="scrollbar-inset-6 mr-1 flex min-w-0 flex-1 flex-col">
      <PageScroll
        isFullWidth
        className="flex flex-col gap-y-3.5 py-6 pr-5 pl-6"
        ref={scrollRef}
        onKeyDown={onKeyDown}
      >
        <Listing
          className="flex flex-col gap-y-3.5"
          errorMessage={t("The mods couldn't be loaded. Try again, or go to another page.")}
          errorTitle={t("Something went wrong")}
          entityCount={mods.length}
          isError={isError}
          isLoading={isLoading}
          noResultsTitle={t("No mods found")}
          onRetry={onRetry}
          skeletonCount={6}
          SkeletonTile={ModCardSkeleton}
        >
          {mods.map((mod) => (
            <ModCard
              isActive={mod.id === activeModId}
              key={mod.id}
              mod={mod}
              tabIndex={mod.id === tabStop ? 0 : -1}
              onSelect={() => onSelectMod(mod.id)}
            />
          ))}
        </Listing>

        <Pagination
          currentPage={currentPage}
          recordsPerPage={MODS_PER_PAGE}
          scrollRef={scrollRef}
          totalRecords={Math.min(totalCount, MAX_PAGES * MODS_PER_PAGE)}
          onPaginationUpdate={onPageChange}
        />
      </PageScroll>
    </div>
  );
};
