import { Tag } from "bbcode-to-react";
import * as React from "react";

import { ProseSpoiler } from "@/ui/components/prose/prose_spoiler/ProseSpoiler";

import { withoutLeadingBlanks } from "./blanks";

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
