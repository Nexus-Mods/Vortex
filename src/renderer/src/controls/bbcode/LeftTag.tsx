import { Tag } from "bbcode-to-react";
import * as React from "react";

/** Left-aligned text, as the parser's own `[center]` and `[right]` align theirs. */
class LeftTag extends Tag {
  public toHTML(): string[] {
    return ['<div style="text-align:left">', this.getContent(), "</div>"];
  }

  public toReact() {
    return <div style={{ textAlign: "left" }}>{this.getComponents()}</div>;
  }
}

export default LeftTag;
