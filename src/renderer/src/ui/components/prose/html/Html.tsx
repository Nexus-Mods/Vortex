import Interweave from "interweave";
import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";
import { webHref } from "@/ui/utils/webHref";

import type { IProseProps } from "../Prose.types";

/** Elements that load media, which go entirely, as an attribute such as `srcset` could load it. */
const MEDIA = new Set(["img", "picture", "source", "video", "audio", "track"]);

/**
 * Leaves out media, so HTML we don't write can't load from elsewhere, and any link's target
 * that isn't a web page, so it can't open a file or app.
 */
const leaveOutUntrusted = (name: string, node: HTMLElement) => {
  if (MEDIA.has(name)) {
    return null;
  }

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
 * browser, as the window sends any navigation there; other links are text, and media is left out.
 */
export const Html = ({ html, size = "md", className }: IHtmlProps) => (
  <div className={joinClasses(["nxm-prose", className], { "nxm-prose-sm": size === "sm" })}>
    <Interweave content={html} filters={FILTERS} />
  </div>
);
