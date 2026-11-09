import { Tag } from "bbcode-to-react";
import * as React from "react";

type ISimpleTagSettings = { STRIP_OUTER?: boolean; DISCARD_TEXT?: boolean };

/** A parameter a tag keeps: the element's property for it, and the values it may take. */
type IKeptParam = { prop: string; isValid: (value: string) => boolean };

/** How many rows or columns a table cell spans, as a small whole number. */
const isSpan = (value: string) => /^[1-9]\d{0,2}$/.test(value);

/** The parameters a table cell keeps, as none can hold an address: its span and alignment. */
const CELL_PARAMS: Record<string, IKeptParam> = {
  colspan: { prop: "colSpan", isValid: isSpan },
  rowspan: { prop: "rowSpan", isValid: isSpan },
  align: { prop: "align", isValid: (value) => ["left", "center", "right"].includes(value) },
};

/** The tag's parameters that are kept and valid, unquoted, by their names in bbcode. */
const keptParams = (params: Record<string, string>, kept: Record<string, IKeptParam>) =>
  Object.entries(params).flatMap(([name, raw]) => {
    const value = String(raw)
      .replace(/^["']|["']$/g, "")
      .toLowerCase();
    return kept[name]?.isValid(value) ? [[name, value] as const] : [];
  });

/**
 * A plain tag, such as `[b]` or `[td]`, as its element with only the parameters it keeps. The
 * parser's own hands every parameter to the element, so `[td background=…]` would load an image
 * from any site and `[b style=…]` would fail to draw.
 */
const safeSimpleTag = (
  element: string,
  settings: ISimpleTagSettings = {},
  kept: Record<string, IKeptParam> = {},
) =>
  class SafeSimpleTag extends Tag {
    constructor(renderer, tagSettings) {
      super(renderer, tagSettings);
      Object.assign(this, settings);
    }

    public toHTML(): string[] {
      const attributes = keptParams(this.params, kept).map(
        ([name, value]) => ` ${name}="${value}"`,
      );
      return [`<${element}${attributes.join("")}>`, this.getContent(), `</${element}>`];
    }

    public toReact() {
      const props = Object.fromEntries(
        keptParams(this.params, kept).map(([name, value]) => [kept[name].prop, value]),
      );
      return React.createElement(element, props, this.getComponents());
    }
  };

/** The parser's plain tags, drawn as it draws them but with only the parameters they keep. */
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
  th: safeSimpleTag("th", {}, CELL_PARAMS),
  td: safeSimpleTag("td", {}, CELL_PARAMS),
};

export default SAFE_SIMPLE_TAGS;
