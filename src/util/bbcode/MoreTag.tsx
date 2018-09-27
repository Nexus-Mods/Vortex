import { Tag } from 'bbcode-to-react';
import * as React from 'react';
import More from '../../controls/More';

class MoreTag extends Tag {
  public toHTML(): string[] {
    return [];
  }

  public toReact() {
    const { id, name } = this.params;
    return (
      <More id={id} name={name}>
        {this.getContent()}
      </More>
    );
  }
}

export default MoreTag;
