import type { ElementAttributes } from "interweave";
import Interweave, { Filter } from "interweave";
import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";

/** Leaves out images' sources, so HTML we don't write can't load from elsewhere. */
class NoRemoteFilter extends Filter {
  public attribute<K extends keyof ElementAttributes>(
    name: K,
    value: ElementAttributes[K],
  ): ElementAttributes[K] | null | undefined {
    return name === "src" ? undefined : value;
  }
}

const FILTERS = [new NoRemoteFilter()];

interface IHtmlProps {
  /** The HTML to render, such as a mod's changelog from Nexus Mods. */
  html: string;
  /** Its type size: the body text's, or smaller, as in a popover. Default `md`. */
  size?: "sm" | "md";
  /** Classes for its wrapper, e.g. to change its colour from the body text's. */
  className?: string;
}

/**
 * HTML we don't write ourselves, such as a mod's changelog, sanitised and rendered in the
 * app's prose styles, as `Markdown` renders markdown. Its links open in the browser, as the
 * window sends any navigation there; its images don't load.
 */
export const Html = ({ html, size = "md", className }: IHtmlProps) => (
  <div className={joinClasses(["nxm-prose", className], { "nxm-prose-sm": size === "sm" })}>
    <Interweave content={html} filters={FILTERS} />
  </div>
);
