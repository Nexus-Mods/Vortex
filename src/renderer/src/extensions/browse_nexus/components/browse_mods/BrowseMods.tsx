import React, { useMemo, useRef, useState } from "react";

import { BrowseModsBar } from "./browse_mods_bar/BrowseModsBar";
import { ModBackdrop } from "./mod_backdrop/ModBackdrop";
import type { IGalleryImage } from "./mod_details/mod_gallery/ModGallery";
import { ModDetails } from "./mod_details/ModDetails";
import { ModList } from "./mod_list/ModList";
import { galleryFor, STATIC_MODS } from "./staticMods";

/**
 * The active game's mods, a static wireframe (LAZ-1346): the `BrowseModsBar` over a body that
 * holds the `ModList` and `ModDetails` side by side, either side of a rule inset from top and
 * bottom, each scrolling on its own. The body blurs the layout's `GameArt` behind it, which the
 * page's translucent pane lets through; the `ModBackdrop` lies inside it, under them. Holds what
 * they share: the mod the details show, and the picture picked in its gallery.
 */
export const BrowseMods = () => {
  const [activeMod, setActiveMod] = useState(STATIC_MODS[0].name);
  const active = STATIC_MODS.find((mod) => mod.name === activeMod) ?? STATIC_MODS[0];
  const gallery = useMemo(() => galleryFor(active), [active]);
  const [picked, setPicked] = useState<IGalleryImage>();
  const detailsRef = useRef<HTMLDivElement>(null);

  /** Opens another mod's details; its gallery starts over at its first picture, and so does this. */
  const selectMod = (name: string) => {
    if (name === activeMod) {
      return;
    }

    setActiveMod(name);
    setPicked(undefined);
  };

  return (
    <>
      <BrowseModsBar />

      <div className="relative flex min-h-0 flex-1 overflow-hidden game-art-backdrop">
        <ModBackdrop src={(picked ?? gallery[0])?.src} />

        <ModList
          activeMod={activeMod}
          detailsRef={detailsRef}
          mods={STATIC_MODS}
          onSelectMod={selectMod}
        />

        <div aria-hidden className="my-6 w-px shrink-0 bg-stroke-weak" />

        <ModDetails gallery={gallery} mod={active} ref={detailsRef} onPick={setPicked} />
      </div>
    </>
  );
};
