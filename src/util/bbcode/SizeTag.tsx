import { Tag } from 'bbcode-to-react';
import * as React from 'react';

class SizeTag extends Tag {
  public toHTML(): string[] {
    const size = this.params.size;

    if (isNaN(size)) {
      return [this.getContent()];
    }

    return [`<span style="font-size:${this.calc(size)}">`, this.getContent(), '</span>'];
  }

  public toReact(): React.ReactChild[] {
    const size = this.params.size;

    if (isNaN(size)) {
      return this.getComponents();
    }

    return [(
      <span style={{ fontSize: this.calc(size) }}>{this.getComponents()}</span>
    )];
  }

  private calc(sizeFactor: number): string {
    return `${1 + sizeFactor * 0.1}rem`;
  }
}

export default SizeTag;
