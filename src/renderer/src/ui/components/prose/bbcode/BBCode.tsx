import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import { renderSafeBBCode, type IBBCodeContext } from "../../../../controls/bbcode";
import type { IExternalImagePlaceholderOptions } from "../external_image_placeholder/ExternalImagePlaceholder";
import type { IProseWithImagesProps } from "../Prose.types";

interface IBBCodeProps extends IProseWithImagesProps {
  /** The bbcode to render, such as a description written with `[b]` and `[url]` tags. */
  bbcode: string;
  /** What its `[url]` and `[link]` tags may do; allow local files only for Vortex's own bbcode. */
  context?: IBBCodeContext;
  /** Shows placeholders for images from outside Nexus Mods, which are otherwise left out. */
  externalImagePlaceholders?: IExternalImagePlaceholderOptions;
}

/**
 * Bbcode we don't write ourselves, such as a mod's description, in the app's prose styles. Images
 * show only if they're from Nexus Mods, others as placeholders where `externalImagePlaceholders`
 * asks, and links open only where `context` allows.
 */
export const BBCode = ({
  bbcode,
  context,
  size = "md",
  className,
  isFromAdultContent,
  externalImagePlaceholders,
}: IBBCodeProps) => (
  <div
    className={joinClasses(["nxm-prose nxm-prose-bbcode", className], {
      "nxm-prose-sm": size === "sm",
    })}
  >
    {renderSafeBBCode(bbcode, { ...context, isFromAdultContent, externalImagePlaceholders })}
  </div>
);
