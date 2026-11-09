import { Tag } from "bbcode-to-react";
import * as React from "react";

type ISimpleTagSettings = { STRIP_OUTER?: boolean; DISCARD_TEXT?: boolean };

/**
 * A plain tag, such as `[b]` or `[td]`, as its element and nothing else. The parser's own hands the
 * tag's parameters to the element, so `[td background=…]` would load an image from any site and
 * `[b style=…]` would fail to draw.
 */
const safeSimpleTag = (element: string, settings: ISimpleTagSettings = {}) =>
  class SafeSimpleTag extends Tag {
    constructor(renderer, tagSettings) {
      super(renderer, tagSettings);
      Object.assign(this, settings);
    }

    public toHTML(): string[] {
      return [`<${element}>`, this.getContent(), `</${element}>`];
    }

    public toReact() {
      return React.createElement(element, null, this.getComponents());
    }
  };

/** The parser's plain tags, drawn as it draws them but without their parameters. */
const SAFE_SIMPLE_TAGS: Record<string, typeof Tag> = {
  b: safeSimpleTag("strong"),
  i: safeSimpleTag("em"),
  u: safeSimpleTag("u"),
  s: safeSimpleTag("strike"),
  h1: safeSimpleTag("h1", { STRIP_OUTER: true }),
  h2: safeSimpleTag("h2", { STRIP_OUTER: true }),
  h3: safeSimpleTag("h3", { STRIP_OUTER: true }),
  h4: safeSimpleTag("h4", { STRIP_OUTER: true }),
  h5: safeSimpleTag("h5", { STRIP_OUTER: true }),
  h6: safeSimpleTag("h6", { STRIP_OUTER: true }),
  pre: safeSimpleTag("pre"),
  table: safeSimpleTag("table", { DISCARD_TEXT: true }),
  thead: safeSimpleTag("thead", { DISCARD_TEXT: true }),
  tbody: safeSimpleTag("tbody", { DISCARD_TEXT: true }),
  tr: safeSimpleTag("tr", { DISCARD_TEXT: true }),
  th: safeSimpleTag("th"),
  td: safeSimpleTag("td"),
};

export default SAFE_SIMPLE_TAGS;
