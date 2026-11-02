import { useRef } from "react";

import type { IExternalImagePlaceholderOptions } from "@/ui/components/prose/external_image_placeholder/ExternalImagePlaceholder";

import { useBrowseModsTracker } from "../browse_mods_tracking/BrowseModsTracking.context";

interface IDescriptionImagePlaceholdersOptions {
  /** The mod's UID, which its events are sent with. */
  modUid: string;
  /** The mod's page on the website, which the placeholders open. */
  modPageUrl: string;
}

/**
 * The placeholders for a mod description's images from outside Nexus Mods, opening the mod's
 * page and counting what's done with them. Each placeholder tells when it's shown, and they're
 * all shown at once, so their counts are sent together, once for the mod.
 */
export const useDescriptionImagePlaceholders = ({
  modUid,
  modPageUrl,
}: IDescriptionImagePlaceholdersOptions): IExternalImagePlaceholderOptions => {
  const tracker = useBrowseModsTracker();
  const shown = useRef({ images: 0, placeholders: 0, isSent: false });

  return {
    websiteUrl: modPageUrl,
    onShown: (imageCount) => {
      const counts = shown.current;

      if (counts.isSent) {
        return;
      }

      if (!counts.placeholders) {
        queueMicrotask(() => {
          counts.isSent = true;
          tracker.trackExternalImagesShown({
            mod_uid: modUid,
            image_count: counts.images,
            placeholder_count: counts.placeholders,
          });
        });
      }

      counts.images += imageCount;
      counts.placeholders += 1;
    },
    onViewWebsite: (source, imageCount) =>
      tracker.trackExternalImagesWebsiteOpened({
        mod_uid: modUid,
        image_count: imageCount,
        source,
      }),
    onWhyOpened: () => tracker.trackExternalImagesWhyOpened({ mod_uid: modUid }),
    onLinkOpened: (domain) =>
      tracker.trackExternalImageLinkOpened({ mod_uid: modUid, link_domain: domain }),
  };
};
