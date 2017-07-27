import { Tag } from 'bbcode-to-react';
import * as React from 'react';

class BrTag extends Tag {
  public toHTML(): string[] {
    return ['<br />'];
  }

  public toReact() {
    return <br />;
  }
}

export default BrTag;
