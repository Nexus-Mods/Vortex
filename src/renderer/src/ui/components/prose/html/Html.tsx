import Interweave from "interweave";
import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";
import { webHref } from "@/ui/utils/webHref";

import type { IProseProps } from "../Prose.types";

/**
 * Leaves out images' sources, so HTML we don't write can't load from elsewhere, and any link
 * that isn't to a web page, so it can't open a file or app.
 */
const leaveOutUntrusted = (name: string, node: HTMLElement) => {
  node.removeAttribute("src");

  if (name === "a" && webHref(node.getAttribute("href") ?? undefined) === undefined) {
    node.removeAttribute("href");
  }

  return node;
};

const FILTERS = [{ node: leaveOutUntrusted }];

interface IHtmlProps extends IProseProps {
  /** The HTML to render, such as a mod's changelog from Nexus Mods. */
  html: string;
}

/**
 * HTML we don't write ourselves, such as a mod's changelog, sanitised and rendered in the
 * app's prose styles, as `Markdown` renders markdown. Its links to web pages open in the
 * browser, as the window sends any navigation there; other links are text, and images don't load.
 */
export const Html = ({ html, size = "md", className }: IHtmlProps) => (
  <div className={joinClasses(["nxm-prose", className], { "nxm-prose-sm": size === "sm" })}>
    <Interweave content={html} filters={FILTERS} />
  </div>
);
