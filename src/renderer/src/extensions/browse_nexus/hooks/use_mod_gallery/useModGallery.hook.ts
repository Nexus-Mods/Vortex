import { skipToken, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { type Mod, modQuery } from "@/extensions/nexus_integration/queries/mod/mod.query";
import type { ModSummary } from "@/extensions/nexus_integration/queries/mod_search/modSearch.query";
import type { IExtensionApi } from "@/types/IExtensionContext";

import type { IGalleryImage } from "../../components/browse_mods/mod_details/mod_gallery/ModGallery";

/**
 * A before/after comparison's after image starts its title with `[compare:<before id>:<before
 * path>]`, and the API leaves the before image out of the gallery, so the site reads the pair from
 * the title. shortcut: parsed here until the v3 API sends the pair as a field (LAZ-1675).
 */
const COMPARE_PREFIX = /^\[compare:\d+:(?:[^\]]*\/)?([^/\]]+)\]/;

/**
 * A gallery image with its comparison's before image, in each size, when it's a comparison's
 * after image. Both are in the same folder, so each size's URL names the before file instead.
 */
const withComparison = (image: IGalleryImage): IGalleryImage => {
  const title = image.title ?? "";
  const match = COMPARE_PREFIX.exec(title);

  if (!match) {
    return image;
  }

  // The path's last segment swapped, keeping any query or fragment. An address that doesn't parse
  // can't load either way, so it's left as it is.
  const beforeFile = (src: string) => {
    const url = URL.parse(src);

    if (!url) {
      return src;
    }

    url.pathname = url.pathname.replace(/[^/]*$/, () => match[1]);
    return url.href;
  };

  return {
    ...image,
    title: title.slice(match[0].length).trim(),
    before: {
      url: beforeFile(image.url),
      thumbnail_url: beforeFile(image.thumbnail_url),
      large_thumbnail_url: beforeFile(image.large_thumbnail_url),
      blurred_thumbnail_url: beforeFile(image.blurred_thumbnail_url),
      blurred_large_thumbnail_url: beforeFile(image.blurred_large_thumbnail_url),
    },
  };
};

/**
 * A mod's images in the authors' order, led by its primary image when they don't include it, as
 * a picture or a comparison's before picture, or the search's thumbnail until the mod's own query
 * has them, standing in for every size.
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
  const gallery = mod.gallery_images.map(withComparison);

  if (!primary || gallery.some(({ url, before }) => [url, before?.url].includes(primary.url))) {
    return gallery;
  }

  return [primary, ...gallery];
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
