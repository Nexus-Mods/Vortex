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

/**
 * An embed the site would play, such as `[youtube]id[/youtube]`, as a link to it instead, so
 * bbcode we don't write loads nothing. One that isn't a web page is left as text.
 */
class EmbedLinkTag extends Tag {
  public toHTML(): string[] {
    return [];
  }

  public toReact() {
    const content = this.renderer.strip(this.getContent(true)).trim();

    if (!content) {
      return [];
    }

    const { href, text } = EMBEDS[this.name](content);

    if (!href) {
      return [text];
    }

    return <a href={href}>{text}</a>;
  }
}

export default EmbedLinkTag;
