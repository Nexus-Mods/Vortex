import { Tag } from 'bbcode-to-react';
import * as React from 'react';

class LineTag extends Tag {
  public toHTML(): string[] {
    return ['<hr />', this.getContent()];
  }

  public toReact() {
    return (
      <div>
        <hr />
        {this.getComponents()}
      </div>
    );
  }
}

export default LineTag;
