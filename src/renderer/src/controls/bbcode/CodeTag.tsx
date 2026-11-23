import { Tag } from "bbcode-to-react";
import * as React from "react";

import { withoutOuterBlanks } from "./blanks";

/**
 * `[code]`, or `[code=inline]`, as its text is written. The parser's own tag hands React text it
 * has already escaped, so a quote shows as `&quot;`, and its line breaks as `<br />`. A block drops
 * the blank lines it starts and ends with; `codeAsWritten` decides which `[code]` is inline.
 */
class CodeTag extends Tag {
  public toHTML(): string[] {
    if (this.params.code === "inline") {
      return ["<code>", this.getContent(true), "</code>"];
    }

    return ["<pre><code>", this.getContent(true), "</code></pre>"];
  }

  public toReact() {
    if (this.params.code === "inline") {
      return <code>{this.getComponents()}</code>;
    }

    return (
      <pre className="nxm-prose-code">
        <code>{withoutOuterBlanks(this.getComponents()) as React.ReactNode[]}</code>
      </pre>
    );
  }
}

export default CodeTag;
