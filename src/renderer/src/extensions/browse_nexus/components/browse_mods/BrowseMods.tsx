import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { currentGame } from "@/extensions/gamemode_management/selectors";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { ResizableSplit } from "@/ui/components/resizable_split/ResizableSplit";
import { useSavedSplit } from "@/ui/components/resizable_split/useSavedSplit.hook";
import type { IToolbarPanelHandle } from "@/ui/components/toolbar/ToolbarPanelButton";
import { nxmModOutline } from "@/ui/icon-paths";

import {
  type ISearchEventProps,
  type SelectionInput,
} from "../../hooks/browse_mods_tracking/browseModsTracker";
import { useBrowseModsTracker } from "../../hooks/browse_mods_tracking/BrowseModsTracking.context";
import { useBrowseModsViews } from "../../hooks/use_browse_mods_views/useBrowseModsViews.hook";
import { useChangeModFilters } from "../../hooks/use_change_mod_filters/useChangeModFilters.hook";
import { useGameDomainName } from "../../hooks/use_game_domain_name/useGameDomainName.hook";
import { useModBrowsingFeedback } from "../../hooks/use_mod_browsing_feedback/useModBrowsingFeedback.hook";
import { useModGallery } from "../../hooks/use_mod_gallery/useModGallery.hook";
import type { IModSearch } from "../../hooks/use_mod_search/useModSearch.hook";
import { useSettledPick } from "../../hooks/use_settled_pick/useSettledPick.hook";
import { emptyStateKind, type IEmptyStateInput } from "../../util/empty_state_kind/emptyStateKind";
import { clearActiveFilters } from "../../util/mod_filters/clear_active_filters/clearActiveFilters";
import { filterEventProps } from "../../util/mod_filters/modFilterList";
import { websiteModSearchUrl } from "../../util/website_mod_search_url/websiteModSearchUrl";
import { BrowseModsBar } from "./browse_mods_bar/BrowseModsBar";
import { LoadMoreFeedback } from "./load_more_feedback/LoadMoreFeedback";
import { ModBackdrop } from "./mod_backdrop/ModBackdrop";
import { ModDetails } from "./mod_details/ModDetails";
import { ModDetailsSkeleton } from "./mod_details/ModDetails.skeleton";
import { type IModListHandle, ModList } from "./mod_list/ModList";
import { LEARN_MORE_URL, ModListEmptyState } from "./mod_list_empty_state/ModListEmptyState";

interface IBrowseModsProps {
  api: IExtensionApi;
  /** The active game's mod search, kept above the tabs. */
  search: IModSearch;
  /** Whether they're on screen; the page stays mounted, searching, while it's left. */
  isShown: boolean;
}

/**
 * The active game's mods: the bar, the edited strip under it, and the list beside the details in
 * a resizable split. The list's pick moves at once; the details show a mod clicked at once, and
 * one picked from the keyboard once the keys settle, so a key held down through the list loads and
 * counts only the mod it stops on. Counts the mod shown, a search seen to come back empty, and
 * retrying one.
 */
export const BrowseMods = ({ api, search, isShown }: IBrowseModsProps) => {
  const { t } = useTranslation();
  const { mods } = search;
  const {
    latestPick: activeMod,
    settledPick: shownMod,
    pickOnceSettled,
    pickNow,
    settleNow,
    cancelPick,
    startWith,
  } = useSettledPick<ModSummary>();

  if (!activeMod && mods[0]) {
    startWith(mods[0]);
  }

  const { gallery, backdrop, setBackdrop } = useModGallery(api, shownMod);
  const detailsRef = useRef<HTMLDivElement>(null);
  const focusDetailsRef = useRef(false);

  useLayoutEffect(() => {
    if (focusDetailsRef.current) {
      focusDetailsRef.current = false;
      detailsRef.current?.focus();
    }
  }, [shownMod]);
  const listRef = useRef<IModListHandle>(null);
  const [split, setSplit] = useSavedSplit("browse-mods");
  const tracker = useBrowseModsTracker();
  const filtersPanelRef = useRef<IToolbarPanelHandle>(null);
  const viewOptionsPanelRef = useRef<IToolbarPanelHandle>(null);
  const panelRefs = useMemo(
    () => ({ filters: filtersPanelRef, viewOptions: viewOptionsPanelRef }),
    [],
  );
  const { viewPicker, editedViewStrip } = useBrowseModsViews(search, panelRefs);
  const { trackedView, sort, filters, status } = search;
  const changeFilters = useChangeModFilters(search);
  const gameName = useSelector(currentGame)?.name;
  const domain = useGameDomainName();

  /**
   * The list's empty state, or its end of results, with its actions counted. Removing the filters
   * or clearing the search keeps focus in the list, as the button goes while the mods load. The
   * search text is what's actually searched, so a search too short to send reads as none.
   */
  const emptyState = ({ isEnd }: Pick<IEmptyStateInput, "isEnd">) => {
    const state = emptyStateKind({
      isEnd,
      searchText: search.searchQuery,
      filterCount: search.activeFilterCount,
    });

    return (
      <ModListEmptyState
        filterCount={search.activeFilterCount}
        gameName={gameName}
        kind={state}
        searchText={search.searchQuery}
        onClearSearch={() => {
          tracker.trackSearchCleared({ view: trackedView, source: "empty_state" });
          search.setSearchText("");
          listRef.current?.focus();
        }}
        onLearnMore={() => {
          tracker.trackEmptyStateLearnMoreOpened({ view: trackedView, state });
          window.api.shell.openUrl(LEARN_MORE_URL);
        }}
        onRemoveFilters={() => {
          tracker.trackEmptyStateFiltersRemoved({
            view: trackedView,
            state,
            filter_count: search.activeFilterCount,
          });
          changeFilters(clearActiveFilters(search), "empty_state");
          listRef.current?.focus();
        }}
        onSearchWebsite={
          domain
            ? () => {
                tracker.trackEmptyStateWebsiteSearchOpened({ view: trackedView, state });
                window.api.shell.openUrl(
                  websiteModSearchUrl(domain, { text: search.searchQuery, sort, filters }),
                );
              }
            : undefined
        }
      />
    );
  };

  const isEmpty = status !== "loading" && status !== "failed" && !mods.length;

  /**
   * The search the results came from, as its events describe it, kept as a string so it only
   * changes when a value does, not when the view's objects are rebuilt, as renaming it does. An
   * empty search is counted once, and again for another view, even one of the user's own alike,
   * or another search of the mods' names.
   */
  const searchedKey = JSON.stringify({
    view: trackedView,
    sort_field: sort.field,
    sort_direction: sort.direction,
    has_search: !!search.searchQuery,
    ...filterEventProps(filters),
  });

  const searched = useMemo(() => JSON.parse(searchedKey) as ISearchEventProps, [searchedKey]);
  const feedback = useModBrowsingFeedback(api, { ...searched, pages_loaded: search.pagesLoaded });

  useEffect(() => {
    if (isEmpty && isShown) {
      tracker.trackNoResults(searched);
    }
  }, [isEmpty, isShown, searched, tracker, search.viewId, search.searchQuery]);

  /** Picks another mod and counts it, shown at once if clicked, else once the keys settle. */
  const selectMod = (id: string, input: SelectionInput) => {
    const index = mods.findIndex((mod) => mod.id === id);

    if ((id === activeMod?.id && id === shownMod?.id) || index < 0) {
      return;
    }

    const choose = input === "pointer" ? pickNow : pickOnceSettled;

    choose(mods[index], () =>
      tracker.trackModSelected({ mod_uid: id, view: trackedView, position: index + 1, input }),
    );
  };

  /**
   * Moves focus into the details, for Right from the list: the picked mod's, shown first if it's
   * still waiting, and focused once they've opened, as the details shown until then go.
   */
  const focusDetails = () => {
    if (activeMod === shownMod) {
      detailsRef.current?.focus();
      return;
    }

    focusDetailsRef.current = true;
    settleNow();
  };

  /**
   * The details' pane: the active mod's, or with none, pulsing while the list loads or saying so,
   * level with the list's own empty state: its scroll area's 24px and the listing's 64px.
   */
  const details = () => {
    if (!shownMod && status === "loading") {
      return <ModDetailsSkeleton />;
    }

    if (!shownMod) {
      return (
        <NoResults
          className="self-start px-6 pt-22 pb-6"
          icon={{ path: nxmModOutline }}
          message={t("Pick a mod from the list to see its details.")}
          title={t("No mod to show")}
        />
      );
    }

    return (
      <ModDetails
        api={api}
        gallery={gallery}
        key={shownMod.id}
        mod={shownMod}
        ref={detailsRef}
        onFocusList={() => listRef.current?.focusOpenMod()}
        onPick={setBackdrop}
      />
    );
  };

  return (
    <>
      <BrowseModsBar
        feedback={{ hasGiven: feedback.hasGiven, onOpen: () => feedback.open("toolbar") }}
        panelRefs={panelRefs}
        search={search}
        viewPicker={viewPicker}
      />

      {editedViewStrip}

      <div className="relative flex min-h-0 flex-1 overflow-hidden game-art-backdrop backdrop-dim-scope">
        <ModBackdrop
          blurredSrc={backdrop?.blurred_large_thumbnail_url}
          isAdult={!!shownMod?.adult}
          src={backdrop?.large_thumbnail_url}
        />

        <ResizableSplit
          className="min-w-0 flex-1"
          end={details()}
          label={t("Resize the list and details")}
          split={split}
          start={
            <ModList
              activeModId={activeMod?.id}
              emptyState={emptyState({ isEnd: false })}
              endOfResults={emptyState({ isEnd: true })}
              listRef={listRef}
              loadMoreFooter={
                <LoadMoreFeedback
                  hasGiven={feedback.hasGiven}
                  key={search.searchKey}
                  onVote={(sentiment) => feedback.open("load_more", sentiment)}
                />
              }
              mods={mods}
              pagesLoaded={search.pagesLoaded}
              searchKey={search.searchKey}
              status={status}
              totalCount={search.totalCount}
              onFocusDetails={focusDetails}
              onLoadMore={(source) => {
                if (source === "button") {
                  tracker.trackLoadMoreClicked({ ...searched, pages_loaded: search.pagesLoaded });
                }

                search.loadMore();
              }}
              onPassLastMod={cancelPick}
              onRetry={() => {
                search.retry();
                tracker.trackRetryClicked({ ...searched, pages_loaded: search.pagesLoaded });
              }}
              onSelectMod={selectMod}
            />
          }
          valueText={(percent) => t("List {{percent}}%", { percent })}
          onSplitChange={setSplit}
        />
      </div>

      {feedback.modal}
    </>
  );
};
