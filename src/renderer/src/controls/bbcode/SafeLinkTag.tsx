import { webHref } from "@/ui/utils/webHref";

import { externalImagePlaceholderFor } from "./externalImages";
import LinkTag from "./LinkTag";

/**
 * A link for bbcode we don't write ourselves. Its target is kept only if it opens a web page, runs
 * a callback the caller gave, or, if the caller allows local files, opens a local file. Any other
 * target leaves the text as plain text, not a link. A link wrapping only an image from outside
 * Nexus Mods is a placeholder for it, when the bbcode's context asks for them.
 */
class SafeLinkTag extends LinkTag {
  public toReact() {
    const placeholder = externalImagePlaceholderFor(this);

    if (placeholder !== undefined) {
      return placeholder;
    }

    return super.toReact();
  }

  protected href(linkUrl: string): string | undefined {
    const { callbacks, allowLocal } = this.renderer.options;

    if (webHref(linkUrl) !== undefined) {
      return linkUrl;
    }

    if (!URL.canParse(linkUrl)) {
      return undefined;
    }

    const { protocol, host } = new URL(linkUrl);

    if (protocol === "cb:" && callbacks?.[host] !== undefined) {
      return linkUrl;
    }

    return allowLocal && protocol === "file:" ? linkUrl : undefined;
  }
}

export default SafeLinkTag;
