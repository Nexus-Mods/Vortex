import { Tag } from "bbcode-to-react";
import * as React from "react";

type ISimpleTagSettings = { STRIP_OUTER?: boolean; DISCARD_TEXT?: boolean };

/**
 * A parameter a tag keeps and the values it may take. It's drawn as the element's property, or, for
 * layout the prose styles also set, as a CSS property in its inline style: the styles would win over
 * the attribute, so `[td align=center]` would stay left-aligned.
 */
type IKeptParam = { isValid: (value: string) => boolean } & (
  | { prop: string }
  | { style: string; toCss?: (value: string) => string }
);

/** How many rows or columns a table cell spans, as a small whole number. */
const isSpan = (value: string) => /^[1-9]\d{0,2}$/.test(value);

/** A width or height, in pixels or as a percentage. */
const isSize = (value: string) => /^\d{1,4}(px|%)?$/.test(value);

/** A bare number is in pixels, as it is for the HTML attribute. */
const sizeToCss = (value: string) => (/^\d+$/.test(value) ? `${value}px` : value);

const isOneOf =
  (...allowed: string[]) =>
  (value: string) =>
    allowed.includes(value);

/** The parameters a table keeps, as none can hold an address: its size. */
const TABLE_PARAMS: Record<string, IKeptParam> = {
  width: { style: "width", isValid: isSize, toCss: sizeToCss },
  height: { style: "height", isValid: isSize, toCss: sizeToCss },
};

/** The parameters a table cell keeps, as none can hold an address: its size, span and alignment. */
const CELL_PARAMS: Record<string, IKeptParam> = {
  ...TABLE_PARAMS,
  colspan: { prop: "colSpan", isValid: isSpan },
  rowspan: { prop: "rowSpan", isValid: isSpan },
  align: { style: "text-align", isValid: isOneOf("left", "center", "right") },
  valign: { style: "vertical-align", isValid: isOneOf("top", "middle", "bottom", "baseline") },
};

/**
 * The tag's parameters that are kept and valid, unquoted: those drawn as attributes, by their names
 * in bbcode and as the element's properties, and those drawn as CSS declarations.
 */
const keptParams = (params: Record<string, string>, kept: Record<string, IKeptParam>) => {
  const attributes: { name: string; prop: string; value: string }[] = [];
  const styles: { property: string; value: string }[] = [];

  for (const [name, raw] of Object.entries(params)) {
    const param = kept[name];
    const value = String(raw)
      .replace(/^["']|["']$/g, "")
      .toLowerCase();

    if (param === undefined || !param.isValid(value)) {
      continue;
    }

    if ("prop" in param) {
      attributes.push({ name, prop: param.prop, value });
    } else {
      styles.push({ property: param.style, value: param.toCss?.(value) ?? value });
    }
  }

  return { attributes, styles };
};

/** A CSS property as React's `style` names it, such as `textAlign` for `text-align`. */
const camelCase = (property: string) =>
  property.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());

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
      const { attributes, styles } = keptParams(this.params, kept);
      const html = attributes.map(({ name, value }) => ` ${name}="${value}"`);

      if (styles.length > 0) {
        const declarations = styles.map(({ property, value }) => `${property}: ${value}`);
        html.push(` style="${declarations.join("; ")}"`);
      }

      return [`<${element}${html.join("")}>`, this.getContent(), `</${element}>`];
    }

    public toReact() {
      const { attributes, styles } = keptParams(this.params, kept);
      const props: Record<string, unknown> = Object.fromEntries(
        attributes.map(({ prop, value }) => [prop, value]),
      );

      if (styles.length > 0) {
        props.style = Object.fromEntries(
          styles.map(({ property, value }) => [camelCase(property), value]),
        );
      }

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
  table: safeSimpleTag("table", { DISCARD_TEXT: true }, TABLE_PARAMS),
  thead: safeSimpleTag("thead", { DISCARD_TEXT: true }),
  tbody: safeSimpleTag("tbody", { DISCARD_TEXT: true }),
  tr: safeSimpleTag("tr", { DISCARD_TEXT: true }),
  th: safeSimpleTag("th", {}, CELL_PARAMS),
  td: safeSimpleTag("td", {}, CELL_PARAMS),
};

export default SAFE_SIMPLE_TAGS;
