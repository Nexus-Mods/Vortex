import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";
import { NoResults } from "@/ui/components/no_results/NoResults";

import type { IModSearch } from "../../hooks/use_mod_search/useModSearch.hook";
import { BrowseModsBar } from "./browse_mods_bar/BrowseModsBar";
import { ModBackdrop } from "./mod_backdrop/ModBackdrop";
import type { IGalleryImage } from "./mod_details/mod_gallery/ModGallery";
import { ModDetails } from "./mod_details/ModDetails";
import { ModDetailsSkeleton } from "./mod_details/ModDetails.skeleton";
import { ModList } from "./mod_list/ModList";

interface IBrowseModsProps {
  api: IExtensionApi;
  /** The active game's mod search, kept above the tabs. */
  search: IModSearch;
}

/**
 * The active game's mods: the bar over the list and details, side by side. The details keep the
 * picked mod, the first until another's picked, through changes of page or sort.
 */
export const BrowseMods = ({ api, search }: IBrowseModsProps) => {
  const { t } = useTranslation();
  const { mods } = search;
  const [activeMod, setActiveMod] = useState<ModSummary>();

  if (!activeMod && mods[0]) {
    setActiveMod(mods[0]);
  }

  const gallery = useMemo<IGalleryImage[]>(
    () =>
      activeMod?.thumbnail_url
        ? [{ src: activeMod.thumbnail_url, thumbnail: activeMod.thumbnail_url }]
        : [],
    [activeMod],
  );
  const [pickedImage, setPickedImage] = useState<IGalleryImage>();
  const backdrop = pickedImage && gallery.includes(pickedImage) ? pickedImage : gallery[0];
  const detailsRef = useRef<HTMLDivElement>(null);

  /** Opens another mod's details; its gallery starts over at its first picture, and so does this. */
  const selectMod = (id: string) => {
    if (id === activeMod?.id) {
      return;
    }

    setActiveMod(mods.find((mod) => mod.id === id));
    setPickedImage(undefined);
  };

  /** The details' half: the active mod's, or with none, pulsing while the list loads or saying so. */
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
        mod={activeMod}
        ref={detailsRef}
        onPick={setPickedImage}
      />
    );
  };

  return (
    <>
      <BrowseModsBar search={search} />

      <div className="relative grid min-h-0 flex-1 grid-cols-2 grid-rows-1 overflow-hidden game-art-backdrop">
        <ModBackdrop
          blurredSrc={activeMod?.blurred_thumbnail_url ?? undefined}
          isAdult={!!activeMod?.adult}
          src={backdrop?.src}
        />

        <ModList
          activeModId={activeMod?.id}
          currentPage={search.currentPage}
          detailsRef={detailsRef}
          isError={!!search.error}
          isLoading={search.loading}
          mods={mods}
          totalCount={search.totalCount}
          onPageChange={search.setCurrentPage}
          onRetry={search.retry}
          onSelectMod={selectMod}
        />

        {details()}

        <div aria-hidden className="absolute inset-y-6 left-1/2 w-px bg-stroke-weak" />
      </div>
    </>
  );
};
