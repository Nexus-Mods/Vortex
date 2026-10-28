import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import { renderSafeBBCode, type IBBCodeContext } from "../../../../controls/bbcode";
import type { IProseWithImagesProps } from "../Prose.types";

interface IBBCodeProps extends IProseWithImagesProps {
  /** The bbcode to render, such as a description written with `[b]` and `[url]` tags. */
  bbcode: string;
  /**
   * What its `[url]` and `[link]` tags may do: run the callbacks they name, or open local files.
   * Only allow local files for bbcode written into Vortex, never for bbcode taken from elsewhere.
   */
  context?: IBBCodeContext;
}

/**
 * Bbcode we don't write ourselves, such as a mod's description, in the app's prose styles. Images
 * show only if they're from Nexus Mods, and links open only where `context` allows.
 */
export const BBCode = ({
  bbcode,
  context,
  size = "md",
  className,
  isFromAdultContent,
}: IBBCodeProps) => (
  <div
    className={joinClasses(["nxm-prose nxm-prose-bbcode", className], {
      "nxm-prose-sm": size === "sm",
    })}
  >
    {renderSafeBBCode(bbcode, { ...context, isFromAdultContent })}
  </div>
);
