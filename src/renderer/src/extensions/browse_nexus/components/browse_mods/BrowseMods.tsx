import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { ResizableSplit } from "@/ui/components/resizable_split/ResizableSplit";
import { useSavedSplit } from "@/ui/components/resizable_split/useSavedSplit.hook";

import { useModGallery } from "../../hooks/use_mod_gallery/useModGallery.hook";
import type { IModSearch } from "../../hooks/use_mod_search/useModSearch.hook";
import { BrowseModsBar } from "./browse_mods_bar/BrowseModsBar";
import { ModBackdrop } from "./mod_backdrop/ModBackdrop";
import { ModDetails } from "./mod_details/ModDetails";
import { ModDetailsSkeleton } from "./mod_details/ModDetails.skeleton";
import { ModList } from "./mod_list/ModList";

interface IBrowseModsProps {
  api: IExtensionApi;
  /** The active game's mod search, kept above the tabs. */
  search: IModSearch;
}

/**
 * The active game's mods: the bar over the list and details, in a split the user can resize and
 * that's saved. The details keep the picked mod, the first until another's picked, through
 * changes of page or sort.
 */
export const BrowseMods = ({ api, search }: IBrowseModsProps) => {
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

  /** Opens another mod's details. */
  const selectMod = (id: string) => {
    if (id === activeMod?.id) {
      return;
    }

    setActiveMod(mods.find((mod) => mod.id === id));
  };

  /** Moves focus to the list's Tab stop, for the details' Left, as Right moves it into them. */
  const focusList = () =>
    listRef.current?.querySelector<HTMLElement>('[data-mod-card][tabindex="0"]')?.focus();

  /** The details' pane: the active mod's, or with none, pulsing while the list loads or saying so. */
  const details = () => {
    if (!activeMod && search.loading) {
      return <ModDetailsSkeleton />;
    }

    if (!activeMod) {
      return (
        <NoResults
          className="self-center p-6"
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
      <BrowseModsBar search={search} />

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
              isError={!!search.error}
              isLoading={search.loading}
              listRef={listRef}
              mods={mods}
              totalCount={search.totalCount}
              onPageChange={search.setCurrentPage}
              onRetry={search.retry}
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
