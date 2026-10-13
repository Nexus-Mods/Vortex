import React, { type ReactNode } from "react";
import ReactMarkdown from "react-markdown";

import { joinClasses } from "@/ui/utils/joinClasses";
import { webHref } from "@/ui/utils/webHref";

import type { IProseProps } from "../Prose.types";

interface IMarkdownProps extends IProseProps {
  /** The markdown to render, such as a changelog. */
  markdown: string;
}

/** A link, its target kept only if it's a web page, so it can't open a file or app. */
const WebLink = ({ href, children }: { href?: string; children?: ReactNode }) => (
  <a href={webHref(href)}>{children}</a>
);

const COMPONENTS = { a: WebLink };

/**
 * Markdown we don't write ourselves, such as a changelog, rendered in the app's prose
 * styles: its own type, so it needs no `Typography` around it. Its links to web pages open
 * in the browser, as the window sends any navigation there; other links are text.
 */
export const Markdown = ({ markdown, size = "md", className }: IMarkdownProps) => (
  <div className={joinClasses(["nxm-prose", className], { "nxm-prose-sm": size === "sm" })}>
    <ReactMarkdown components={COMPONENTS}>{markdown}</ReactMarkdown>
  </div>
);
