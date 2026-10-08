import React from "react";
import ReactMarkdown from "react-markdown";

import { joinClasses } from "@/ui/utils/joinClasses";

interface IMarkdownProps {
  /** The markdown to render, such as a changelog. */
  markdown: string;
  /** Classes for its wrapper, e.g. to change its size or colour from the body text's. */
  className?: string;
}

/**
 * Markdown we don't write ourselves, such as a changelog, rendered in the app's prose
 * styles: its own type, so it needs no `Typography` around it. Its links open in the
 * browser, as the window sends any navigation there.
 */
export const Markdown = ({ markdown, className }: IMarkdownProps) => (
  <div className={joinClasses(["nxm-prose", className])}>
    <ReactMarkdown>{markdown}</ReactMarkdown>
  </div>
);
