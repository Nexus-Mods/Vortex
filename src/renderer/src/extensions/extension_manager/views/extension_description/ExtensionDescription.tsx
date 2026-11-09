import * as React from "react";
import { useMemo } from "react";

import Spinner from "../../../../controls/Spinner";
import { BBCode } from "../../../../ui/components/prose/bbcode/BBCode";
import { NEXUS_BASE_URL } from "../../../nexus_integration/constants";

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
    () => ({ websiteUrl: `${NEXUS_BASE_URL}/site/mods/${modId}` }),
    [modId],
  );

  return description === undefined ? (
    <Spinner />
  ) : (
    <BBCode bbcode={description} externalImagePlaceholders={externalImagePlaceholders} size="sm" />
  );
};
