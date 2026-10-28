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
  /** The details pane, for Right to move focus to. */
  detailsRef: RefObject<HTMLDivElement>;
  /** The list itself, for the details pane's Left to move focus back to. */
  listRef?: RefObject<HTMLDivElement>;
}

/** Which mod each key picks from the list itself, rather than from a mod. */
const FROM_LIST: Partial<Record<string, "first" | "last">> = {
  ArrowDown: "first",
  Home: "first",
  ArrowUp: "last",
  End: "last",
};

/**
 * Browse's list of mods, with pagination that stays through a failed page, which offers to try
 * again. One Tab stop, the open mod or else the first; Up, Down, Home and End pick a mod, and
 * Right moves focus into the details. A change of page focuses the list itself, picking nothing
 * until Down or Up picks its first or last mod.
 */
export const ModList = ({
  mods,
  activeModId,
  onSelectMod,
  detailsRef,
  listRef,
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

  /** Picks the list's first or last mod, as the key asks, and focuses it. */
  const pickFromList = (event: KeyboardEvent<HTMLDivElement>) => {
    const end = FROM_LIST[event.key];
    const cards = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-mod-card]")];
    const index = end === "last" ? cards.length - 1 : 0;

    if (!end || !cards[index]) {
      return;
    }

    event.preventDefault();
    onSelectMod(mods[index].id);
    cards[index].focus();
  };

  /** Moves to another page, focusing the list, which picks no mod until asked. */
  const changePage = (page: number) => {
    onPageChange(page);
    scrollRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isOnCard = rovingFocus(event, {
      orientation: "vertical",
      itemSelector: "[data-mod-card]",
      onMove: (index) => onSelectMod(mods[index].id),
    });

    if (isOnCard || hasModifierKey(event)) {
      return;
    }

    if (event.target === event.currentTarget) {
      pickFromList(event);
      return;
    }

    if (event.key !== "ArrowRight") {
      return;
    }

    const fromCard =
      event.target instanceof HTMLElement && !!event.target.closest("[data-mod-card]");
    const details = detailsRef.current;

    if (fromCard && details) {
      event.preventDefault();
      details.focus();
    }
  };

  return (
    <div
      className="scrollbar-inset-6 mr-1 flex min-w-0 flex-1 flex-col has-[>:focus-visible]:outline-2 has-[>:focus-visible]:-outline-offset-2 has-[>:focus-visible]:outline-focus-subdued"
      ref={listRef}
    >
      <PageScroll
        isFullWidth
        aria-label={t("Mods")}
        className="flex flex-col gap-y-3.5 py-6 pr-5 pl-6"
        ref={scrollRef}
        role="region"
        tabIndex={-1}
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
          onPaginationUpdate={changePage}
        />
      </PageScroll>
    </div>
  );
};
