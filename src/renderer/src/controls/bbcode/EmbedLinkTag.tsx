import { Tag } from "bbcode-to-react";
import * as React from "react";

import { webHref } from "@/ui/utils/webHref";

/** Where each embed goes and what its link says, from what's inside the tag. */
const EMBEDS: Record<string, (content: string) => { href?: string; text: string }> = {
  youtube: (id) => ({
    href: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
    text: `https://www.youtube.com/watch?v=${id}`,
  }),
  video: (id) => EMBEDS.youtube(id),
  twitter: (handle) => ({
    href: `https://twitter.com/${encodeURIComponent(handle)}`,
    text: `@${handle}`,
  }),
  soundcloud: (url) => ({ href: webHref(url), text: url }),
};

/** The characters the parser escapes in a tag's text, as it writes them. */
const ESCAPED: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"' };

/**
 * An embed the site would play, such as `[twitter]handle[/twitter]` or `[soundcloud]`, as a link to
 * it instead, so bbcode we don't write loads nothing. One that isn't a web page is left as text.
 * `YoutubeTag` falls back to its `youtube` and `video` links for anything that isn't a video.
 */
class EmbedLinkTag extends Tag {
  public toHTML(): string[] {
    return [];
  }

  public toReact() {
    const content = this.contentText();

    if (!content) {
      return [];
    }

    const { href, text } = EMBEDS[this.name](content);

    if (!href) {
      return [text];
    }

    return <a href={href}>{text}</a>;
  }

  /** The tag's text as written, which the parser hands over escaped. */
  protected contentText() {
    return this.renderer
      .strip(this.getContent(true))
      .replace(/&(?:amp|lt|gt|quot);/g, (escaped) => ESCAPED[escaped])
      .trim();
  }
}

export default EmbedLinkTag;
