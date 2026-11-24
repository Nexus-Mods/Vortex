import { Tag } from "bbcode-to-react";
import * as React from "react";

import More from "../More";

/**
 * A `[more]` popover. For bbcode we don't write ourselves, its parser's `safe` option is set, so
 * the popover shows only Nexus Mods images, blurred if what the bbcode's from is adult content.
 * Its options are read while the parser renders, as they're unset by the time React does.
 */
class MoreTag extends Tag {
  public toHTML(): string[] {
    return [];
  }

  public toReact() {
    const { safe, isFromAdultContent } = this.renderer.options;
    const { id, name, wikiId } = Object.keys(this.params).reduce((prev: any, par) => {
      prev[par] = this.params[par].replace(/^["']|["']$/g, "");
      return prev;
    }, {});
    return (
      <More id={id} isFromAdultContent={isFromAdultContent} name={name} safe={safe} wikiId={wikiId}>
        {this.getContent(true)}
      </More>
    );
  }
}

export default MoreTag;
