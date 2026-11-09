import React, { useMemo } from "react";

import Spinner from "@/controls/Spinner";
import { nexusSiteModPageUrl } from "@/extensions/nexus_integration/util/nexus_urls/nexusUrls";
import { BBCode } from "@/ui/components/prose/bbcode/BBCode";

interface IExtensionDescriptionProps {
  /** The extension's description from its mod page; undefined while it's being fetched. */
  description: string | undefined;
  /** The extension's mod id on Nexus Mods. */
  modId: number;
}

/**
 * An extension's description in Browse Extensions. Images show only if they're from Nexus Mods,
 * others as placeholders pointing to the extension's page.
 */
export const ExtensionDescription = ({ description, modId }: IExtensionDescriptionProps) => {
  const externalImagePlaceholders = useMemo(
    () => ({ websiteUrl: nexusSiteModPageUrl(modId) }),
    [modId],
  );

  return description === undefined ? (
    <Spinner />
  ) : (
    <BBCode bbcode={description} externalImagePlaceholders={externalImagePlaceholders} size="sm" />
  );
};
