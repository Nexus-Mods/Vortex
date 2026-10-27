import React, { useMemo, useRef, useState } from "react";

import type { IModSearch } from "../../hooks/use_mod_search/useModSearch.hook";
import { BrowseModsBar } from "./browse_mods_bar/BrowseModsBar";
import { ModBackdrop } from "./mod_backdrop/ModBackdrop";
import type { IGalleryImage } from "./mod_details/mod_gallery/ModGallery";
import { ModDetails } from "./mod_details/ModDetails";
import { ModList } from "./mod_list/ModList";

interface IBrowseModsProps {
  /** The active game's mod search, kept above the tabs. */
  search: IModSearch;
}

/**
 * The active game's mods (LAZ-1346): the `BrowseModsBar` over a body that holds the `ModList` and
 * `ModDetails` side by side, half each, each scrolling on its own, with a rule over the seam inset
 * from top and bottom. The details keep their half while there's no mod to show, so the list
 * stays its width. The body blurs the layout's `GameArt` behind it, which the page's translucent
 * pane lets through; the `ModBackdrop` lies inside it, under them. Holds what they share: the mod
 * the details show, the page's first until another's picked, and the picture picked in its
 * gallery, which has only the mod's thumbnail, the one picture the mod search returns.
 */
export const BrowseMods = ({ search }: IBrowseModsProps) => {
  const { mods } = search;
  const [activeModId, setActiveModId] = useState<string>();
  const active = mods.find((mod) => mod.id === activeModId) ?? mods[0];
  const gallery = useMemo<IGalleryImage[]>(
    () =>
      active?.thumbnail_url ? [{ src: active.thumbnail_url, thumbnail: active.thumbnail_url }] : [],
    [active],
  );
  const [picked, setPicked] = useState<IGalleryImage>();
  const backdrop = picked && gallery.includes(picked) ? picked : gallery[0];
  const detailsRef = useRef<HTMLDivElement>(null);

  /** Opens another mod's details; its gallery starts over at its first picture, and so does this. */
  const selectMod = (id: string) => {
    if (id === active?.id) {
      return;
    }

    setActiveModId(id);
    setPicked(undefined);
  };

  return (
    <>
      <BrowseModsBar search={search} />

      <div className="relative grid min-h-0 flex-1 grid-cols-2 grid-rows-1 overflow-hidden game-art-backdrop">
        <ModBackdrop src={backdrop?.src} />

        <ModList
          activeModId={active?.id}
          currentPage={search.currentPage}
          detailsRef={detailsRef}
          isError={!!search.error}
          isLoading={search.loading}
          mods={mods}
          totalCount={search.totalCount}
          onPageChange={search.setCurrentPage}
          onSelectMod={selectMod}
        />

        {!!active && (
          <ModDetails gallery={gallery} mod={active} ref={detailsRef} onPick={setPicked} />
        )}

        <div aria-hidden className="absolute inset-y-6 left-1/2 w-px bg-stroke-weak" />
      </div>
    </>
  );
};
