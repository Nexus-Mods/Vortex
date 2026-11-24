import { Tag } from "bbcode-to-react";
import * as React from "react";

import { CODE_BRACKET } from "./codeAsWritten";

/** Code with the `[`s `codeAsWritten` hid put back. */
const withBrackets = (code: string) => code.split(CODE_BRACKET).join("[");

/**
 * `[code]`, or `[code=inline]`, as its text is written. The parser's own tag hands React text it
 * has already escaped, so a quote shows as `&quot;`. `codeAsWritten` decides which `[code]` is
 * inline, and hides the tags inside it from the parser, which this shows again.
 */
class CodeTag extends Tag {
  public toHTML(): string[] {
    if (this.params.code === "inline") {
      return ["<code>", withBrackets(this.getContent(true)), "</code>"];
    }

    return ["<pre><code>", withBrackets(this.getContent(true)), "</code></pre>"];
  }

  public toReact() {
    const code = this.getComponents().map((node) =>
      typeof node === "string" ? withBrackets(node) : node,
    );

    if (this.params.code === "inline") {
      return <code>{code}</code>;
    }

    return (
      <pre className="nxm-prose-code">
        <code>{code}</code>
      </pre>
    );
  }
}

export default CodeTag;
