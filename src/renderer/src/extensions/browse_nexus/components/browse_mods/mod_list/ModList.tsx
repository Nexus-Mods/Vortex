import numeral from "numeral";
import React, {
  type ReactNode,
  type Ref,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { Listing } from "@/ui/components/listing/Listing";
import {
  type ListingStatus,
  type LoadMoreSource,
  PAGES_BEFORE_PAUSE,
} from "@/ui/components/listing/listing_status/listingStatus";
import { PageScroll } from "@/views/components/Page/PageScroll";

import type { SelectionInput } from "../../../hooks/browse_mods_tracking/browseModsTracker";
import { useModListKeyboard } from "../../../hooks/use_mod_list_keyboard/useModListKeyboard.hook";
import { useModListVirtualizer } from "../../../hooks/use_mod_list_virtualizer/useModListVirtualizer.hook";
import { MODS_PER_PAGE } from "../../../hooks/use_mod_search/useModSearch.hook";
import { isBreakNudgePause } from "../../../util/break_nudge/breakNudge";
import { ModCard } from "../mod_card/ModCard";
import { ModCardSkeleton } from "../mod_card/ModCard.skeleton";

/** How often, in mods, Load more nudges the user back to their game, at the first pause past. */
const NUDGE_EVERY_MODS = 600;

interface IModListProps {
  /** The mods loaded so far, in order. */
  mods: ModSummary[];
  /** Which search they're from; a change scrolls back to the top. */
  searchKey: string;
  /** The picked mod's id, which the details show once a keyboard pick settles; maybe not listed. */
  activeModId: string | undefined;
  /** Picks another mod, by id, told how it was picked. */
  onSelectMod: (id: string, input: SelectionInput) => void;
  /** Where the pages' loading is. */
  status: ListingStatus;
  /** How many mods the search found, for the count over Load more. */
  totalCount: number;
  /** How many pages have loaded, for the note over Load more, which counts them in full pages. */
  pagesLoaded: number;
  /** Asks for the next page: as the list's end nears, or from Load more, back on the last card. */
  onLoadMore: (source: LoadMoreSource) => void;
  /** Asks for the page that failed again; focus goes to the list, as the Try again button goes. */
  onRetry: () => void;
  /** Moves focus into the details pane, for Right from a card. */
  onFocusDetails: () => void;
  /** Called as Down moves focus past the last mod onto Load more, passing rather than stopping. */
  onPassLastMod?: () => void;
  /** Shown in place of the mods when there are none. */
  emptyState: ReactNode;
  /** Shown after the last card once the last page has loaded. */
  endOfResults: ReactNode;
  /** Shown under the Load more button while loading is paused. */
  loadMoreFooter?: ReactNode;
  /** The list, for moving focus back into it or onto its open mod. */
  listRef?: Ref<IModListHandle>;
}

/** What the list lets its page do with focus. */
export interface IModListHandle {
  /** Focuses the list itself. */
  focus: () => void;
  /** Focuses the open mod's card, the list's Tab stop. */
  focusOpenMod: () => void;
}

/**
 * Browse's list of mods, loading more as its end scrolls into view, and rendering only the cards
 * near it. A later page that fails offers to try again where it would go. One Tab stop, the open
 * mod or else the first; Up, Down, Home and End pick a mod, and Right moves focus into the
 * details. A mod picked from the keyboard is focused once it renders, which it does as the open
 * one wherever it is. Another search scrolls back to the top. With no mods it shows the empty
 * state, and once the last page has loaded, the end of results after it.
 */
export const ModList = ({
  mods,
  searchKey,
  activeModId,
  onSelectMod,
  onFocusDetails,
  onPassLastMod,
  listRef,
  status,
  totalCount,
  pagesLoaded,
  onLoadMore,
  onRetry,
  emptyState,
  endOfResults,
  loadMoreFooter,
}: IModListProps) => {
  const { t } = useTranslation();
  const isLastPageLoaded = !!mods.length && status === "done";
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagedCount = pagesLoaded * MODS_PER_PAGE;
  const cards = useRef(new Map<number, HTMLElement>()).current;
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const activeIndex = mods.findIndex((mod) => mod.id === activeModId);
  const tabStop = activeIndex >= 0 ? activeIndex : 0;
  const virtualizer = useModListVirtualizer({
    scrollRef,
    count: mods.length,
    getItemKey: useCallback((index: number) => mods[index].id, [mods]),
    keptIndex: mods.length ? tabStop : undefined,
  });
  const { scrollToTop } = virtualizer;
  const shownSearchRef = useRef(searchKey);

  useLayoutEffect(() => {
    if (shownSearchRef.current !== searchKey) {
      shownSearchRef.current = searchKey;
      scrollToTop();
    }
  }, [searchKey, scrollToTop]);

  useImperativeHandle(
    listRef,
    () => ({
      focus: () => scrollRef.current?.focus(),
      focusOpenMod: () => cards.get(tabStop)?.focus(),
    }),
    [cards, tabStop],
  );

  const onKeyDown = useModListKeyboard({
    cards,
    mods,
    searchKey,
    isLoading: status === "loading",
    onSelectMod,
    onFocusDetails,
    afterLastCardRef: loadMoreRef,
    onPassLastCard: onPassLastMod,
  });

  return (
    <div className="scrollbar-inset-6 mr-1 flex min-w-0 flex-1 flex-col focus-ring-inset">
      <PageScroll
        isFullWidth
        aria-label={t("Mods")}
        className="flex flex-col gap-y-3.5 py-6 pr-5 pl-6"
        ref={scrollRef}
        role="region"
        tabIndex={-1}
        onBlur={virtualizer.onBlur}
        onFocus={virtualizer.onFocus}
        onKeyDown={onKeyDown}
      >
        <Listing
          className="flex flex-col gap-y-3.5"
          customNoResults={emptyState}
          entityCount={mods.length}
          errorMessage={t("The mods couldn't be loaded. Try again.")}
          errorTitle={t("Something went wrong")}
          loadMoreErrorMessage={t("More mods couldn't be loaded. Try again.")}
          loadMoreFooter={loadMoreFooter}
          loadMoreLabel={t("Load more mods")}
          loadMoreNote={
            isBreakNudgePause({
              loaded: pagedCount,
              every: NUDGE_EVERY_MODS,
              perPause: PAGES_BEFORE_PAUSE * MODS_PER_PAGE,
            })
              ? t("{{loaded}} mods later... remember the game you were going to play?", {
                  loaded: numeral(pagedCount).format("0,0"),
                })
              : undefined
          }
          loadMoreRef={loadMoreRef}
          loadMoreSummary={t("Showing {{loaded}} of {{total}} mods", {
            loaded: numeral(mods.length).format("0,0"),
            total: numeral(totalCount).format("0,0"),
          })}
          scrollRef={scrollRef}
          skeletonCount={6}
          SkeletonTile={ModCardSkeleton}
          status={status}
          onLoadMore={(source) => {
            onLoadMore(source);

            if (source !== "button") {
              return;
            }

            const lastCard = cards.get(mods.length - 1);

            if (lastCard) {
              lastCard.focus({ preventScroll: true });
              return;
            }

            scrollRef.current?.focus();
          }}
          onRetry={() => {
            onRetry();
            scrollRef.current?.focus();
          }}
        >
          <div
            className="relative -mb-3.5"
            ref={virtualizer.startRef}
            style={{ height: virtualizer.totalSize }}
          >
            {virtualizer.items.map(({ index, key, start }) => (
              <div
                className="absolute inset-x-0 top-0 flex flex-col pb-3.5"
                data-index={index}
                key={key}
                ref={virtualizer.measureElement}
                style={{ transform: `translateY(${start}px)` }}
              >
                <ModCard
                  isActive={mods[index].id === activeModId}
                  mod={mods[index]}
                  ref={(card) => {
                    if (card) {
                      cards.set(index, card);
                      return;
                    }

                    cards.delete(index);
                  }}
                  tabIndex={index === tabStop ? 0 : -1}
                  onSelect={() => onSelectMod(mods[index].id, "pointer")}
                />
              </div>
            ))}
          </div>
        </Listing>

        {isLastPageLoaded && endOfResults}
      </PageScroll>
    </div>
  );
};
