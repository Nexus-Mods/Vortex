import { Tag } from "bbcode-to-react";
import * as React from "react";

class StyleTag extends Tag {
  public toHTML(): string[] {
    const style = this.className(this.params.style);

    return [style ? `<span class="${style}">` : "<span>", this.getContent(), "</span>"];
  }

  public toReact() {
    return <span className={this.className(this.params.style)}>{this.getComponents()}</span>;
  }

  /** The class the tag puts on its text. Subclasses can limit which classes it may be. */
  protected className(style: string | undefined): string | undefined {
    return style;
  }
}

export default StyleTag;
