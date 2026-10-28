import React, { type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

import { joinClasses } from "@/ui/utils/joinClasses";
import { webHref } from "@/ui/utils/webHref";

import type { IProseProps } from "../Prose.types";

interface IMarkdownProps extends IProseProps {
  /** The markdown to render, such as a changelog. */
  markdown: string;
  /**
   * Keeps images, loaded from secure web addresses only. Only for markdown we write ourselves or
   * trust; others' keeps them left out.
   */
  allowMedia?: boolean;
}

/** A link, its target kept only if it's a web page, so it can't open a file or app. */
const WebLink = ({ href, children }: { href?: string; children?: ReactNode }) => (
  <a href={webHref(href)}>{children}</a>
);

/** An image, kept only if it loads from a secure web address. */
const SecureImage = ({ src, alt }: { src?: string; alt?: string }) =>
  src !== undefined && URL.canParse(src) && new URL(src).protocol === "https:" ? (
    <img alt={alt} src={src} />
  ) : null;

const COMPONENTS = { a: WebLink };
const COMPONENTS_WITH_MEDIA = { a: WebLink, img: SecureImage };

/** Images are left out, so markdown we don't write can't load from elsewhere. */
const DISALLOWED = ["img"];

/**
 * Markdown we don't write ourselves, such as a changelog, rendered in the app's prose
 * styles: its own type, so it needs no `Typography` around it. Its links to web pages open
 * in the browser, as the window sends any navigation there; other links are text, and images
 * are left out unless `allowMedia` is set.
 */
export const Markdown = ({
  markdown,
  size = "md",
  className,
  allowMedia = false,
}: IMarkdownProps) => (
  <div className={joinClasses(["nxm-prose", className], { "nxm-prose-sm": size === "sm" })}>
    <ReactMarkdown
      components={allowMedia ? COMPONENTS_WITH_MEDIA : COMPONENTS}
      disallowedElements={allowMedia ? [] : DISALLOWED}
    >
      {markdown}
    </ReactMarkdown>
  </div>
);
