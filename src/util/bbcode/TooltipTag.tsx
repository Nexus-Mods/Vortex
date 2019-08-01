import { Tag } from 'bbcode-to-react';
import * as React from 'react';

function nop() {
  // nop
}

class TooltipTag extends Tag {
  public toHTML(): string[] {
    return [this.getContent()];
  }

  public toReact() {
    const { tooltip } = this.params;
    return <a onClick={nop} title={tooltip}>{this.getComponents()}</a>;
  }
}

export default TooltipTag;
