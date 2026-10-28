import React, { type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

import { joinClasses } from "@/ui/utils/joinClasses";
import { webHref } from "@/ui/utils/webHref";

import type { IProseWithImagesProps } from "../Prose.types";
import { ProseImage } from "../prose_image/ProseImage";

interface IMarkdownProps extends IProseWithImagesProps {
  /** The markdown to render, such as a changelog. */
  markdown: string;
  /**
   * Keeps images, loaded from web addresses only. Only for markdown we write ourselves or
   * trust; others' keeps them left out.
   */
  allowMedia?: boolean;
}

/** A link, its target kept only if it's a web page, so it can't open a file or app. */
const WebLink = ({ href, children }: { href?: string; children?: ReactNode }) => (
  <a href={webHref(href)}>{children}</a>
);

/** An image, kept only if it loads from a web address, for markdown we trust. */
const SecureImage = ({ src, alt }: { src?: string; alt?: string }) =>
  webHref(src) === undefined ? null : <img alt={alt} src={src} />;

const COMPONENTS_WITH_MEDIA = { a: WebLink, img: SecureImage };

/**
 * Markdown we don't write ourselves, such as a changelog, in the app's prose styles. Links open
 * only if they go to a web page, and images show only if they're from Nexus Mods, unless
 * `allowMedia` is set, when images from any web address are kept.
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
      components={
        allowMedia
          ? COMPONENTS_WITH_MEDIA
          : {
              a: WebLink,
              img: ({ src, alt }) => (
                <ProseImage alt={alt} isFromAdultContent={isFromAdultContent} src={src} />
              ),
            }
      }
    >
      {markdown}
    </ReactMarkdown>
  </div>
);
