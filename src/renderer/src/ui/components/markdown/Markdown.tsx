import React from "react";
import ReactMarkdown from "react-markdown";

import { joinClasses } from "@/ui/utils/joinClasses";

interface IMarkdownProps {
  /** The markdown to render, such as a changelog. */
  markdown: string;
  /** Its type size: the body text's, or smaller, as in a popover. Default `md`. */
  size?: "sm" | "md";
  /** Classes for its wrapper, e.g. to change its colour from the body text's. */
  className?: string;
}

/**
 * Markdown we don't write ourselves, such as a changelog, rendered in the app's prose
 * styles: its own type, so it needs no `Typography` around it. Its links open in the
 * browser, as the window sends any navigation there.
 */
export const Markdown = ({ markdown, size = "md", className }: IMarkdownProps) => (
  <div className={joinClasses(["nxm-prose", className], { "nxm-prose-sm": size === "sm" })}>
    <ReactMarkdown>{markdown}</ReactMarkdown>
  </div>
);
