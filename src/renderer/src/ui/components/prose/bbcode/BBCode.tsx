import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

import { renderSafeBBCode, type IBBCodeContext } from "../../../../controls/bbcode";
import type { IProseProps } from "../Prose.types";

interface IBBCodeProps extends IProseProps {
  /** The bbcode to render, such as a description written with `[b]` and `[url]` tags. */
  bbcode: string;
  /**
   * What its `[url]` and `[link]` tags may do: run the callbacks they name, or open local files.
   * Only allow local files for bbcode written into Vortex, never for bbcode taken from elsewhere.
   */
  context?: IBBCodeContext;
}

/**
 * Bbcode, such as a description from a site or an extension, in the prose styles `Markdown`,
 * `Html` and `PlainText` render theirs in, so it needs no `Typography` around it. The tags are
 * drawn by the app's bbcode renderer. As `Html` does, it leaves out images and videos, and a link
 * is kept only if it goes to a web page, to a callback in `context`, or to a local file `context`
 * allows. Any other link is text. A `[style]` keeps only the classes our dialogs use to colour
 * text.
 */
export const BBCode = ({ bbcode, context, size = "md", className }: IBBCodeProps) => (
  <div className={joinClasses(["nxm-prose", className], { "nxm-prose-sm": size === "sm" })}>
    {renderSafeBBCode(bbcode, context)}
  </div>
);
