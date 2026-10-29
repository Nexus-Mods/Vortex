import { skipToken, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { type Mod, modQuery } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IGalleryImage } from "../../components/browse_mods/mod_details/mod_gallery/ModGallery";

/**
 * A mod's images in the authors' order, led by its primary image when they don't include it, or
 * the search's thumbnail until the mod's own query has them. For a user who blurs adult images,
 * the API sends only the primary image, blurred.
 */
const getGalleryImages = (summary: ModSummary, mod?: Mod): IGalleryImage[] => {
  if (!mod) {
    return summary.thumbnail_url
      ? [{ src: summary.thumbnail_url, thumbnail: summary.thumbnail_url }]
      : [];
  }

  const gallery = mod.gallery_images.map(({ url, thumbnail_url, title }) => ({
    src: url,
    thumbnail: thumbnail_url,
    title,
  }));
  const primary = mod.primary_image;

  if (!primary || gallery.some(({ src }) => src === primary.url)) {
    return gallery;
  }

  return [
    {
      src: primary.url ?? primary.blurred_large_thumbnail_url,
      thumbnail: primary.thumbnail_url ?? primary.blurred_thumbnail_url,
    },
    ...gallery,
  ];
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
