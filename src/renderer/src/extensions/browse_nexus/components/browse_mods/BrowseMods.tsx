import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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
import { useModGallery } from "../../hooks/use_mod_gallery/useModGallery.hook";
import { type IModSearch, MODS_PER_PAGE } from "../../hooks/use_mod_search/useModSearch.hook";
import { filterEventProps } from "../../util/mod_filters/modFilterList";
import { BrowseModsBar } from "./browse_mods_bar/BrowseModsBar";
import { ModBackdrop } from "./mod_backdrop/ModBackdrop";
import { ModDetails } from "./mod_details/ModDetails";
import { ModDetailsSkeleton } from "./mod_details/ModDetails.skeleton";
import { ModList } from "./mod_list/ModList";

interface IBrowseModsProps {
  api: IExtensionApi;
  /** The active game's mod search, kept above the tabs. */
  search: IModSearch;
  /** Whether they're on screen; the page stays mounted, searching, while it's left. */
  isShown: boolean;
}

/**
 * The active game's mods: the bar, the edited strip under it, and the list beside the details in
 * a resizable split. Counts picking a mod, a search seen to come back empty, and retrying one.
 */
export const BrowseMods = ({ api, search, isShown }: IBrowseModsProps) => {
  const { t } = useTranslation();
  const { mods } = search;
  const [activeMod, setActiveMod] = useState<ModSummary>();

  if (!activeMod && mods[0]) {
    setActiveMod(mods[0]);
  }

  const { gallery, backdrop, setBackdrop } = useModGallery(api, activeMod);
  const detailsRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useSavedSplit("browse-mods");
  const tracker = useBrowseModsTracker();
  const filtersPanelRef = useRef<IToolbarPanelHandle>(null);
  const viewOptionsPanelRef = useRef<IToolbarPanelHandle>(null);
  const panelRefs = useMemo(
    () => ({ filters: filtersPanelRef, viewOptions: viewOptionsPanelRef }),
    [],
  );
  const { viewPicker, editedViewStrip } = useBrowseModsViews(search, panelRefs);
  const { trackedView, sort, filters, currentPage, error } = search;
  const isEmpty = !search.loading && !error && !mods.length;

  /**
   * The search the results came from, as its events describe it, kept as a string so it only
   * changes when a value does, not when the view's objects are rebuilt, as renaming it does. An
   * empty search is counted once, and again for another view, even one of the user's own alike.
   */
  const searchedKey = JSON.stringify({
    view: trackedView,
    sort_field: sort.field,
    sort_direction: sort.direction,
    ...filterEventProps(filters),
  });

  const searched = useMemo(() => JSON.parse(searchedKey) as ISearchEventProps, [searchedKey]);

  useEffect(() => {
    if (isEmpty && isShown) {
      tracker.trackNoResults(searched);
    }
  }, [isEmpty, isShown, searched, tracker, search.viewId]);

  /** Opens another mod's details. */
  const selectMod = (id: string, input: SelectionInput) => {
    if (id === activeMod?.id) {
      return;
    }

    const index = mods.findIndex((mod) => mod.id === id);
    setActiveMod(mods[index]);

    if (index >= 0) {
      tracker.trackModSelected({
        mod_uid: id,
        view: trackedView,
        position: (currentPage - 1) * MODS_PER_PAGE + index + 1,
        input,
      });
    }
  };

  /** Moves focus to the list's Tab stop, for the details' Left, as Right moves it into them. */
  const focusList = () =>
    listRef.current?.querySelector<HTMLElement>('[data-mod-card][tabindex="0"]')?.focus();

  /**
   * The details' pane: the active mod's, or with none, pulsing while the list loads or saying so,
   * level with the list's own empty state: its scroll area's 24px and the listing's 64px.
   */
  const details = () => {
    if (!activeMod && search.loading) {
      return <ModDetailsSkeleton />;
    }

    if (!activeMod) {
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
        key={activeMod.id}
        mod={activeMod}
        ref={detailsRef}
        onFocusList={focusList}
        onPick={setBackdrop}
      />
    );
  };

  return (
    <>
      <BrowseModsBar panelRefs={panelRefs} search={search} viewPicker={viewPicker} />

      {editedViewStrip}

      <div className="relative flex min-h-0 flex-1 overflow-hidden game-art-backdrop backdrop-dim-scope">
        <ModBackdrop
          blurredSrc={backdrop?.blurred_large_thumbnail_url}
          isAdult={!!activeMod?.adult}
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
              currentPage={search.currentPage}
              detailsRef={detailsRef}
              isError={!!error}
              isLoading={search.loading}
              listRef={listRef}
              mods={mods}
              totalCount={search.totalCount}
              onPageChange={search.setCurrentPage}
              onRetry={() => {
                search.retry();
                tracker.trackRetryClicked({ ...searched, page: currentPage });
              }}
              onSelectMod={selectMod}
            />
          }
          valueText={(percent) => t("List {{percent}}%", { percent })}
          onSplitChange={setSplit}
        />
      </div>
    </>
  );
};
