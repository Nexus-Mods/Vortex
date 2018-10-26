import { Tag } from 'bbcode-to-react';
import * as React from 'react';
import More from '../../controls/More';

class MoreTag extends Tag {
  public toHTML(): string[] {
    return [];
  }

  public toReact() {
    const { id, name, wikiId } = Object.keys(this.params).reduce((prev: any, par) => {
      prev[par] = this.params[par].replace(/^["']|["']$/g, '');
      return prev;
    } , {});
    return (
      <More id={id} name={name} wikiId={wikiId}>
        {this.getContent(true)}
      </More>
    );
  }
}

export default MoreTag;
