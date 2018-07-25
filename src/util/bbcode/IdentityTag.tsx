import { Tag } from 'bbcode-to-react';

class IdentityTag extends Tag {
  public toHTML(): string[] {
    return [this.getContent()];
  }

  public toReact() {
    return this.getComponents();
  }
}

export default IdentityTag;
