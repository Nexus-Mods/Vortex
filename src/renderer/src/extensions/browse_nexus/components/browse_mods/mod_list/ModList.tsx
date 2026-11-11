import React, {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import { Listing } from "@/ui/components/listing/Listing";
import { hasModifierKey } from "@/ui/utils/hasModifierKey";
import { PageScroll } from "@/views/components/Page/PageScroll";

import type { SelectionInput } from "../../../hooks/browse_mods_tracking/browseModsTracker";
import { useModListVirtualizer } from "../../../hooks/use_mod_list_virtualizer/useModListVirtualizer.hook";
import { ModCard } from "../mod_card/ModCard";
import { ModCardSkeleton } from "../mod_card/ModCard.skeleton";

interface IModListProps {
  /** The mods loaded so far, in order. */
  mods: ModSummary[];
  /** Which search they're from; a change scrolls back to the top. */
  searchKey: string;
  /** The picked mod's id, which the details show once a keyboard pick settles; maybe not listed. */
  activeModId: string | undefined;
  /** Picks another mod, by id, told how it was picked. */
  onSelectMod: (id: string, input: SelectionInput) => void;
  /** Whether the first page is loading. */
  isLoading: boolean;
  /** Whether the first page failed to load. */
  isError: boolean;
  /** Whether there are more mods to load. */
  hasMore: boolean;
  /** Whether a page is loading with mods on screen: the next, or the first again. */
  isLoadingMore: boolean;
  /** Whether a later page failed to load. */
  isLoadMoreError: boolean;
  /** Asks for the next page, if there is one and nothing's loading. */
  onLoadMore: () => void;
  /** Asks for the page that failed again; focus goes to the list, as the Try again button goes. */
  onRetry: () => void;
  /** Moves focus into the details pane, for Right from a card. */
  onFocusDetails: () => void;
  /** Shown in place of the mods when there are none. */
  emptyState: ReactNode;
  /** Shown after the last card once the last page has loaded. */
  endOfResults: ReactNode;
  /** The list's scrolling region, for moving focus back into the list. */
  listRef?: RefObject<HTMLDivElement>;
}

/** Which mod each key picks from the list itself, rather than from a mod. */
const FROM_LIST: Partial<Record<string, "first" | "last">> = {
  ArrowDown: "first",
  Home: "first",
  ArrowUp: "last",
  End: "last",
};

/** Which mod each key moves to from the one at `at`, of the mods up to `last`. */
const FROM_CARD: Partial<Record<string, (at: number, last: number) => number>> = {
  ArrowDown: (at) => at + 1,
  ArrowUp: (at) => at - 1,
  Home: () => 0,
  End: (_, last) => last,
};

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
  listRef,
  isLoading,
  isError,
  hasMore,
  isLoadingMore,
  isLoadMoreError,
  onLoadMore,
  onRetry,
  emptyState,
  endOfResults,
}: IModListProps) => {
  const { t } = useTranslation();
  const isLastPageLoaded =
    !!mods.length && !hasMore && !isLoading && !isLoadingMore && !isLoadMoreError;
  const ownScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = listRef ?? ownScrollRef;
  const focusTargetRef = useRef<number>();
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
      focusTargetRef.current = undefined;
      scrollToTop();
    }
  }, [searchKey, scrollToTop]);

  /** Focuses the card the keyboard last moved to, once it's rendered, and forgets it. */
  const focusTarget = () => {
    if (focusTargetRef.current === undefined) {
      return;
    }

    const card = scrollRef.current?.querySelector<HTMLElement>(
      `[data-index="${focusTargetRef.current}"] [data-mod-card]`,
    );

    if (card) {
      card.focus();
      focusTargetRef.current = undefined;
    }
  };

  useLayoutEffect(focusTarget);

  /** Picks the mod at `index` and focuses it. */
  const moveTo = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();

    if (!mods[index]) {
      return;
    }

    focusTargetRef.current = index;
    onSelectMod(mods[index].id, "keyboard");
    focusTarget();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (hasModifierKey(event) || !mods.length || isLoading) {
      return;
    }

    const last = mods.length - 1;
    const at =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-index]")?.dataset.index
        : undefined;

    if (event.target === event.currentTarget) {
      const end = FROM_LIST[event.key];

      if (end) {
        moveTo(event, end === "last" ? last : 0);
      }

      return;
    }

    const step = at === undefined ? undefined : FROM_CARD[event.key];

    if (step) {
      moveTo(event, Math.min(Math.max(step(Number(at), last), 0), last));
      return;
    }

    if (event.key === "ArrowRight" && at !== undefined) {
      event.preventDefault();
      onFocusDetails();
    }
  };

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
          hasMore={hasMore}
          isError={isError}
          isLoading={isLoading}
          isLoadingMore={isLoadingMore}
          isLoadMoreError={isLoadMoreError}
          loadMoreErrorMessage={t("More mods couldn't be loaded. Try again.")}
          scrollRef={scrollRef}
          skeletonCount={6}
          SkeletonTile={ModCardSkeleton}
          onLoadMore={onLoadMore}
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
