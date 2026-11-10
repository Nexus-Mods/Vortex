import React from "react";
import ReactMarkdown from "react-markdown";

import { joinClasses } from "@/ui/utils/joinClasses";

import type { IProseWithImagesProps } from "../Prose.types";
import { ProseImage } from "../prose_image/ProseImage";
import { WebLink } from "../web_link/WebLink";

interface IMarkdownProps extends IProseWithImagesProps {
  /** The markdown to render, such as a changelog. */
  markdown: string;
  /**
   * Keeps images, loaded from web addresses only. Only for markdown we write ourselves or
   * trust; others' keeps them left out.
   */
  allowMedia?: boolean;
}

/**
 * Markdown we don't write ourselves, such as a changelog, in the app's prose styles. Links open
 * only if they go to a web page, and images show only if they're from Nexus Mods, unless
 * `allowMedia` is set, when https images from any site are kept.
 */
export const Markdown = ({
  markdown,
  size = "md",
  className,
  isFromAdultContent,
  allowMedia = false,
}: IMarkdownProps) => (
  <div className={joinClasses(["nxm-prose", className], { "nxm-prose-sm": size === "sm" })}>
    <ReactMarkdown
      components={{
        a: WebLink,
        img: ({ src, alt }) => (
          <ProseImage
            allowAnyDomain={allowMedia}
            alt={alt}
            isFromAdultContent={isFromAdultContent}
            src={src}
          />
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  </div>
);
