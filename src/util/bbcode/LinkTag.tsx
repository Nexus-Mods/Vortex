import { Tag } from 'bbcode-to-react';
import opn = require('opn');
import * as React from 'react';

class LinkTag extends Tag {
  public toHTML() {
    let url = this.renderer.strip(this.params[this.name] || this.getContent(true));
    if (/javascript:/i.test(url)) {
      url = '';
    }

    if (!url || !url.length) {
      return this.getContent();
    }

    return this.renderer.context(
      { linkify: false },
      () => [`<a href="${url}" target="_blank">`, this.getContent(), '</a>'],
    );
  }

  public toReact() {
    let url = this.renderer.strip(this.params[this.name] || this.getContent(true));
    if (/javascript:/i.test(url)) {
      url = '';
    }

    if (!url || !url.length) {
      return this.getComponents();
    }

    if (this.name === 'email') {
      url = `mailto:${url}`;
    }

    return (
      <a href={url} onClick={this.clicked}>
        {this.getComponents()}
      </a>
    );
  }

  private clicked = (evt: React.MouseEvent<any>) => {
    evt.preventDefault();
    opn(evt.currentTarget.href);
  }
}

export default LinkTag;
