import * as bbcode from "bbcode-to-react";
import type * as React from "react";

import BrTag from "./BrTag";
import CompareTag from "./CompareTag";
import EmbedLinkTag from "./EmbedLinkTag";
import FontTag from "./FontTag";
import HeadingTag from "./HeadingTag";
import IdentityTag from "./IdentityTag";
import LeftTag from "./LeftTag";
import LineTag from "./LineTag";
import LinkTag from "./LinkTag";
import MoreTag from "./MoreTag";
import SafeImageTag from "./SafeImageTag";
import SafeLinkTag from "./SafeLinkTag";
import SafeSizeTag from "./SafeSizeTag";
import SafeSpoilerTag from "./SafeSpoilerTag";
import SafeStyleTag from "./SafeStyleTag";
import SizeTag from "./SizeTag";
import SpoilerTag from "./SpoilerTag";
import StyleTag from "./StyleTag";
import SvgTag from "./SvgTag";
import TooltipTag from "./TooltipTag";
import YoutubeTag from "./YoutubeTag";

/**
 * options that can be passed into the bbcode parser to configure how bbcode
 * tags are being translated.
 */
export interface IBBCodeContext {
  /**
   * callbacks that can be triggered through the [link] or [url] tags
   * callback functions registered here can be triggered with
   * [url=cb://<callback name>/<arg1>/<arg2>/...] (arguments are optional of course)
   */
  callbacks?: { [name: string]: (...args: unknown[]) => void };
  /**
   * if enabled, [link] or [url] tags may link to local files, which then get opened
   * with opn.
   * This should only be set for bbcode hard coded into Vortex, not bbcode taken from a
   * website or anything for security reasons
   */
  allowLocal?: boolean;
  /** Whether what the bbcode's from, such as a mod, is adult content; blurs its images if set to. */
  isFromAdultContent?: boolean;
}

const createFullParser = (safe: boolean) => {
  const parser = new bbcode.Parser();

  parser.registerTag("size", safe ? SafeSizeTag : SizeTag);
  parser.registerTag("br", BrTag);
  parser.registerTag("email", safe ? SafeLinkTag : LinkTag);
  parser.registerTag("link", safe ? SafeLinkTag : LinkTag);
  parser.registerTag("url", safe ? SafeLinkTag : LinkTag);
  parser.registerTag("spoiler", safe ? SafeSpoilerTag : SpoilerTag);
  parser.registerTag("font", FontTag);
  parser.registerTag("youtube", safe ? EmbedLinkTag : YoutubeTag);
  parser.registerTag("line", LineTag);
  parser.registerTag("heading", HeadingTag);
  parser.registerTag("svg", SvgTag);
  parser.registerTag("more", MoreTag);
  parser.registerTag("tooltip", TooltipTag);
  parser.registerTag("style", safe ? SafeStyleTag : StyleTag);
  parser.registerTag("left", LeftTag);

  // The parser's own image tag loads whatever address it is given.
  if (safe) {
    parser.registerTag("img", SafeImageTag);
    parser.registerTag("compare", CompareTag);
    ["video", "twitter", "soundcloud"].forEach((tag) => parser.registerTag(tag, EmbedLinkTag));
  }

  return parser;
};

const fullParser = createFullParser(false);

// For bbcode we don't write ourselves: images only from Nexus Mods, embeds as links, and links only
// to places they are allowed to go.
const safeParser = createFullParser(true);

const stripParser = new bbcode.Parser();
stripParser.registerTag("br", BrTag);
[
  "size",
  "email",
  "font",
  "link",
  "url",
  "spoiler",
  "font",
  "youtube",
  "line",
  "heading",
  "svg",
  "b",
  "u",
  "style",
].forEach((tag) => stripParser.registerTag(tag, IdentityTag));

let convertDiv: HTMLDivElement;

function transformSymbol(fullMatch, symbol: string): string {
  if (convertDiv === undefined) {
    convertDiv = document.createElement("div");
  }
  convertDiv.innerHTML = symbol;
  return convertDiv.innerText;
}

/** The site's legacy tags, as the tags the parser draws them with. */
const LEGACY_TAGS: Array<[RegExp, string]> = [
  [/\[ol\]/gi, "[list=1]"],
  [/\[\/ol\]/gi, "[/list]"],
  [/\[ul\]/gi, "[list]"],
  [/\[\/ul\]/gi, "[/list]"],
  [/\[aimg=([^\]]*)\]/gi, "[img align=$1]"],
  [/\[\/aimg\]/gi, "[/img]"],
];

export function preProcess(input: string): string {
  return LEGACY_TAGS.reduce(
    (text, [legacy, tag]) => text.replace(legacy, tag),
    input.replace(/<br *\/?>/g, "[br][/br]").replace(/(&[^;]+;)/g, transformSymbol),
  );
}

function render(parser: typeof fullParser, input: string, context?: unknown): React.ReactChild[] {
  if (input === undefined) {
    return [""];
  }

  if (context !== undefined) {
    return parser["renderer"].context(context, () => parser.toReact(preProcess(input)));
  } else {
    return parser.toReact(preProcess(input));
  }
}

function renderBBCode(input: string, context?: unknown): React.ReactChild[] {
  return render(fullParser, input, context);
}

/** As `renderBBCode`, for bbcode we don't write ourselves: Nexus images, embeds as links, safe links. */
export function renderSafeBBCode(input: string, context?: unknown): React.ReactChild[] {
  return render(safeParser, input, context);
}

export function stripBBCode(input: string): string {
  if (input === undefined) {
    return "";
  }

  return stripParser
    .toReact(input.replace(/<br *\/?>/g, "[br][/br]").replace(/(&[^;]+;)/g, transformSymbol))
    .filter((line) => typeof line === "string")
    .join("");
}

export function bbcodeToHTML(input: string): string {
  const res: string | string[] = fullParser.toHTML(preProcess(input));
  // according to the typings toHTML should return an array of strings but
  // in practice I found it to return just a string
  if (Array.isArray(res)) {
    return res.join();
  } else {
    return res;
  }
}

export default renderBBCode;
