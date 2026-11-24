import { Tag } from "bbcode-to-react";
import * as React from "react";

import { ProseSpoiler } from "@/ui/components/prose/prose_spoiler/ProseSpoiler";

/** Whether a piece of content is only blank space or a line break. */
const isBlank = (node: unknown) =>
  (typeof node === "string" && !node.trim()) || (React.isValidElement(node) && node.type === "br");

/** The content from its first piece that isn't blank, so it doesn't open on empty lines. */
const withoutLeadingBlanks = (nodes: unknown[]) => {
  const start = nodes.findIndex((node) => !isBlank(node));

  if (start === -1) {
    return [];
  }

  return nodes.slice(start);
};

/** A spoiler for bbcode we don't write ourselves, drawn by `ProseSpoiler` without leading blanks. */
class SafeSpoilerTag extends Tag {
  public toHTML(): string[] {
    return [this.getContent()];
  }

  public toReact() {
    return (
      <ProseSpoiler label={this.params.label}>
        {withoutLeadingBlanks(this.getComponents()) as React.ReactNode[]}
      </ProseSpoiler>
    );
  }
}

export default SafeSpoilerTag;
