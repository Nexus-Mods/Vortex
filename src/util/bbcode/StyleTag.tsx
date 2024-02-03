import { Tag } from 'bbcode-to-react';
import * as React from 'react';

class StyleTag extends Tag {
  public toHTML(): string[] {
    const style = this.params.style;

    return [`<span class="${style}">`, this.getContent(), '</span>'];
  }

  public toReact() {
    const style = this.params.style;

    return (
      <span className={ style }>{this.getComponents()}</span>
    );
  }
}

export default StyleTag;