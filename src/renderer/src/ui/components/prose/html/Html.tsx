import Interweave from "interweave";
import React from "react";

import { joinClasses } from "@/ui/utils/joinClasses";
import { webHref } from "@/ui/utils/webHref";

import type { IProseWithImagesProps } from "../Prose.types";
import { ProseImage } from "../prose_image/ProseImage";

/** Elements that load media other than an image, which go entirely. */
const MEDIA = new Set(["picture", "source", "video", "audio", "track"]);

/** The media that can be allowed: what a GitHub release's notes embed. The rest always goes. */
const ALLOWED_MEDIA = new Set(["img", "source", "video"]);

/** Attributes that name a file to load; only a web address is kept. */
const MEDIA_SOURCES = ["src", "poster"];

/** Leaves a link's target only if it's a web page, so it can't open a file or app. */
const keepLinkTargetsToWebPages = (name: string, node: HTMLElement) => {
  if (name === "a" && webHref(node.getAttribute("href") ?? undefined) === undefined) {
    node.removeAttribute("href");
  }
};

/**
 * Leaves out media other than images, which `ProseImage` checks, and any link's target that
 * isn't a web page, so HTML we don't write can't load from elsewhere or open a file or app.
 */
const leaveOutUntrusted = (name: string, node: HTMLElement) => {
  if (MEDIA.has(name)) {
    return null;
  }

  node.removeAttribute("srcset");

  if (name !== "img") {
    node.removeAttribute("src");
  }

  keepLinkTargetsToWebPages(name, node);

  return node;
};

/**
 * As `leaveOutUntrusted`, but images and video stay, loading only from a web address. An
 * image with no such address goes, and `srcset` always does, as it can name more than one file.
 */
const leaveOutUntrustedKeepingMedia = (name: string, node: HTMLElement) => {
  if (!ALLOWED_MEDIA.has(name)) {
    return MEDIA.has(name) ? null : leaveOutUntrusted(name, node);
  }

  node.removeAttribute("srcset");

  for (const attribute of MEDIA_SOURCES) {
    if (webHref(node.getAttribute(attribute) ?? undefined) === undefined) {
      node.removeAttribute(attribute);
    }
  }

  return name === "img" && !node.hasAttribute("src") ? null : node;
};

const FILTERS = [{ node: leaveOutUntrusted }];
const FILTERS_KEEPING_MEDIA = [{ node: leaveOutUntrustedKeepingMedia }];

/**
 * GitHub wraps a video in `<details open><summary>file.mp4</summary>…</details>`, and Interweave
 * lets a `details` hold only a `summary`, so the video would go. The wrapper is taken off and the
 * summary, which is just the file's name, with it.
 */
const unwrapDetails = (html: string) => {
  const document = new DOMParser().parseFromString(html, "text/html");

  for (const details of document.body.querySelectorAll("details")) {
    details.querySelector(":scope > summary")?.remove();
    details.replaceWith(...details.childNodes);
  }

  return document.body.innerHTML;
};

/** An `img` as a `ProseImage`; anything else is left as it is. */
const imageFrom = (
  node: HTMLElement,
  isFromAdultContent: boolean | undefined,
  allowAnyDomain: boolean,
) => {
  if (node.tagName !== "IMG") {
    return undefined;
  }

  return (
    <ProseImage
      allowAnyDomain={allowAnyDomain}
      alt={node.getAttribute("alt") ?? ""}
      height={Number(node.getAttribute("height")) || undefined}
      isFromAdultContent={isFromAdultContent}
      src={node.getAttribute("src") ?? undefined}
      width={Number(node.getAttribute("width")) || undefined}
    />
  );
};

interface IHtmlProps extends IProseWithImagesProps {
  /** The HTML to render, such as a mod's changelog from Nexus Mods. */
  html: string;
  /**
   * Keeps images and video, loaded from web addresses only, such as a release's
   * screenshots. Only for HTML we write ourselves or trust; others' keeps it left out.
   */
  allowMedia?: boolean;
}

/**
 * HTML we don't write ourselves, such as a mod's changelog, sanitised, in the app's prose styles.
 * Links open only if they go to a web page, and images show only if they're from Nexus Mods,
 * unless `allowMedia` is set, when https images from any site, and video from any web address,
 * are kept.
 */
export const Html = ({
  html,
  size = "md",
  className,
  isFromAdultContent,
  allowMedia = false,
}: IHtmlProps) => (
  <div className={joinClasses(["nxm-prose", className], { "nxm-prose-sm": size === "sm" })}>
    <Interweave
      noWrap
      content={allowMedia ? unwrapDetails(html) : html}
      filters={allowMedia ? FILTERS_KEEPING_MEDIA : FILTERS}
      transform={(node) => imageFrom(node, isFromAdultContent, allowMedia)}
    />
  </div>
);
