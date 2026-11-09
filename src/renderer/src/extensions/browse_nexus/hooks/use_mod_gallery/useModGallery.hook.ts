import { skipToken, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { type Mod, modQuery } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IGalleryImage } from "../../components/browse_mods/mod_details/mod_gallery/ModGallery";

/**
 * A mod's images in the authors' order, led by its primary image when they don't include it, or
 * the search's thumbnail until the mod's own query has them, standing in for every size.
 */
const getGalleryImages = (summary: ModSummary, mod?: Mod): IGalleryImage[] => {
  if (!mod) {
    if (!summary.thumbnail_url) {
      return [];
    }

    return [
      {
        url: summary.thumbnail_url,
        thumbnail_url: summary.thumbnail_url,
        large_thumbnail_url: summary.thumbnail_url,
        blurred_thumbnail_url: summary.blurred_thumbnail_url,
        blurred_large_thumbnail_url: summary.blurred_thumbnail_url,
      },
    ];
  }

  const primary = mod.primary_image;

  if (!primary || mod.gallery_images.some(({ url }) => url === primary.url)) {
    return [...mod.gallery_images];
  }

  return [primary, ...mod.gallery_images];
};

/**
 * The open mod's gallery, and the image behind Browse: the one picked from it, or its first until
 * one is. Another mod's gallery starts over at its first.
 */
export const useModGallery = (api: IExtensionApi, mod?: ModSummary) => {
  const { data: details } = useQuery(modQuery(api, mod?.id ?? skipToken));
  const gallery = useMemo(() => (mod ? getGalleryImages(mod, details) : []), [mod, details]);
  const [picked, setPicked] = useState<IGalleryImage>();
  const backdrop = picked && gallery.includes(picked) ? picked : gallery[0];

  return { gallery, backdrop, setBackdrop: setPicked };
};
