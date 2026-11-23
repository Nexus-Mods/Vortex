import { Tag } from "bbcode-to-react";
import React from "react";

/**
 * Stands in for `[` in a code block until `CodeTag` draws it, so the parser takes nothing in the
 * block for a tag, such as the `[i]` in `a[i]`. A private-use character, so text won't have it.
 */
const CODE_BRACKET = String.fromCharCode(0xe000);

/** A code block, up to its `[/code]`, or to the end for a block without one, as the parser reads it. */
const CODE_BLOCK_RE = /(\[code(?:[= ][^\]]*)?\])([\s\S]*?)(\[\/code\]|$)/gi;

/**
 * A line break, which `preProcess` makes of a `<br />`, with a newline either side of it. A
 * description keeps a newline next to each `<br />`, so the two break the line once.
 */
const LINE_BREAK_RE = /\r?\n?\[br\]\[\/br\]\r?\n?/g;

/**
 * Bbcode, after `preProcess`, with each code block's text kept as written: one newline for each
 * line break, and no tags for the parser to find in it.
 */
export const withLiteralCode = (input: string): string =>
  input.replace(
    CODE_BLOCK_RE,
    (_, open: string, content: string, close: string) =>
      open + content.replace(LINE_BREAK_RE, "\n").replaceAll("[", CODE_BRACKET) + close,
  );

/** Text with the brackets `withLiteralCode` stood in for put back. */
const withBrackets = (text: string): string => text.replaceAll(CODE_BRACKET, "[");

/**
 * `[code]`, `[code=inline]` and `[code=<language>]`, showing their text as written. The parser's
 * own code tag escapes the text for HTML, which React then shows as `&quot;`, and prints the tags
 * in it back as bbcode, such as the `[br]` each line of a description starts with.
 */
class CodeTag extends Tag {
  constructor(renderer: unknown, settings: unknown) {
    super(renderer, settings);
    // As the parser's own code tag: a block drops the newline after it, since it ends its line.
    this.STRIP_OUTER = !this.#inline;
  }

  get #inline(): boolean {
    return this.params.code === "inline";
  }

  get #className(): string {
    const lang: string | undefined = this.params.lang ?? this.params[this.name];
    return lang ? `prettyprint lang-${lang}` : "prettyprint";
  }

  /** Only text, since `withLiteralCode` leaves the parser no tags to find in the block. */
  get #text(): string {
    return withBrackets(this.children.map((child) => child.text).join("")).replace(
      /^(\r?\n)+|(\r?\n)+$/g,
      "",
    );
  }

  /** The block as bbcode, for a tag that shows what it wraps as text, such as `[more]`. */
  public toText(contentAsHTML?: boolean): string {
    return withBrackets(super.toText(contentAsHTML));
  }

  public toHTML(): string[] {
    const text: string = this.renderer.escape(this.#text);

    if (this.#inline) {
      return ["<code>", text, "</code>"];
    }

    return [`<pre class="${this.renderer.escape(this.#className)}">`, text, "</pre>"];
  }

  public toReact() {
    if (this.#inline) {
      return <code>{this.#text}</code>;
    }

    return <pre className={this.#className}>{this.#text}</pre>;
  }
}

export default CodeTag;
