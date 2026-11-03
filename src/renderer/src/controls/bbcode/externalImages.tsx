import React, { type ReactElement, type ReactNode } from "react";

import {
  ExternalImagePlaceholder,
  type IExternalImage,
  type IExternalImagePlaceholderOptions,
} from "@/ui/components/prose/external_image_placeholder/ExternalImagePlaceholder";
import { webImageSrc } from "@/ui/utils/web_image_src/webImageSrc";

/** A tag as the parser builds its tree, which its typings leave out. */
interface IParsedTag {
  name: string | null;
  text: string;
  params: Record<string, string | undefined>;
  parent: IParsedTag | null;
  children: IParsedTag[];
  renderer: {
    strip: (text: string) => string;
    options: { externalImagePlaceholders?: IExternalImagePlaceholderOptions };
  };
  getContent: (raw?: boolean) => string;
  toReact: () => ReactNode;
}

/** The tags that link what they wrap. */
const LINK_TAGS = ["url", "link"];

/** An image's host, if its source is a web image from outside Nexus Mods. */
const externalHostOf = (src: string) => {
  if (webImageSrc(src) || !URL.canParse(src)) {
    return undefined;
  }

  const { protocol, hostname } = new URL(src);
  return ["http:", "https:"].includes(protocol) ? hostname : undefined;
};

/** The tag's children that aren't only whitespace. */
const contentOf = (tag: IParsedTag) => tag.children.filter((child) => !isGap(child));

/** Whether a tag is nothing between images: whitespace or a line break. */
const isGap = (tag: IParsedTag) =>
  tag.name === "br" || (tag.name === null && !tag.text.trim() && !tag.children.length);

/**
 * The external image a tag stands for: an `[img]` from outside Nexus Mods, or a link wrapping
 * nothing but one, with its target. Undefined for any other tag.
 */
const externalImageOf = (tag: IParsedTag): IExternalImage | undefined => {
  if (tag.name === "img") {
    const host = externalHostOf(tag.renderer.strip(tag.getContent(true)));
    return host ? { host, alt: tag.params.alt || tag.params.title } : undefined;
  }

  const [only, ...rest] = contentOf(tag);

  if (!tag.name || !LINK_TAGS.includes(tag.name) || !only || rest.length) {
    return undefined;
  }

  const image = externalImageOf(only);
  return image && only.name === "img" ? { ...image, href: tag.params[tag.name] } : undefined;
};

/** The siblings either side of a tag, nearest first, skipping nothing. */
const siblingsOf = (tag: IParsedTag) => {
  const siblings = tag.parent?.children ?? [tag];
  const index = siblings.indexOf(tag);
  return { before: siblings.slice(0, index).reverse(), after: siblings.slice(index + 1) };
};

/**
 * The images in a run starting at an image, up to the first sibling that isn't one or a gap. The
 * gaps inside the run draw nothing, as the placeholder stands for all of it; they're drawn after
 * the run's first image, so are still to draw.
 */
const runFrom = (first: IExternalImage, after: IParsedTag[]) => {
  const images = [first];
  let gaps: IParsedTag[] = [];

  for (const sibling of after) {
    if (isGap(sibling)) {
      gaps.push(sibling);
      continue;
    }

    const image = externalImageOf(sibling);

    if (!image) {
      break;
    }

    images.push(image);
    gaps.forEach((gap) => (gap.toReact = () => null));
    gaps = [];
  }

  return images;
};

/**
 * What a tag shows for an external image, when the bbcode's context asks for placeholders: the
 * placeholder for the run it starts, nothing for one later in a run, and undefined for a tag
 * that isn't an external image, or when placeholders aren't asked for, to draw as it would.
 */
export const externalImagePlaceholderFor = (tag: unknown): ReactElement | null | undefined => {
  const parsed = tag as IParsedTag;
  const { externalImagePlaceholders } = parsed.renderer.options;
  const image = externalImagePlaceholders && externalImageOf(parsed);

  if (!externalImagePlaceholders || !image) {
    return undefined;
  }

  const { before, after } = siblingsOf(parsed);
  const previous = before.find((sibling) => !isGap(sibling));

  if (previous && externalImageOf(previous)) {
    return null;
  }

  return <ExternalImagePlaceholder images={runFrom(image, after)} {...externalImagePlaceholders} />;
};
