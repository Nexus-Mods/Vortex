import opn from '../opn';

import { Tag } from 'bbcode-to-react';
import * as React from 'react';
import * as url from 'url';

class LinkTag extends Tag {
  public toHTML() {
    let linkUrl = this.renderer.strip(this.params[this.name] || this.getContent(true));
    if (/javascript:/i.test(linkUrl)) {
      linkUrl = '';
    }

    if (!linkUrl || !linkUrl.length) {
      return this.getContent();
    }

    return this.renderer.context(
      { linkify: false },
      () => [`<a href="${linkUrl}" target="_blank" title="${linkUrl}">`, this.getContent(), '</a>'],
    );
  }

  public toReact() {
    let linkUrl = this.renderer.strip(this.params[this.name] || this.getContent(true));
    if (/javascript:/i.test(linkUrl)) {
      linkUrl = '';
    }

    if (!linkUrl || !linkUrl.length) {
      return this.getComponents();
    }

    if (this.name === 'email') {
      linkUrl = `mailto:${linkUrl}`;
    }

    const {callbacks, allowLocal} = this.renderer.options;
    return (
      <a
        href={linkUrl}
        // tslint:disable-next-line:jsx-no-lambda
        onClick={(evt) => this.clicked(evt, callbacks, allowLocal)}
        title={linkUrl}
      >
        {this.getComponents()}
      </a>
    );
  }

  private clicked = (evt: React.MouseEvent<any>, callbacks, allowLocal: boolean) => {
    evt.preventDefault();
    const uri = evt.currentTarget.href;
    const parsed = url.parse(uri);
    const protocols = allowLocal
      ? ['http:', 'https:', 'file:']
      : ['http:', 'https:'];

    if ((parsed.protocol === 'cb:') && (callbacks?.[parsed.host] !== undefined)) {
      const args = parsed.path.slice(1).split('/').map(seg => decodeURIComponent(seg));
      callbacks[parsed.host](...args);
    } else if (protocols.includes(parsed.protocol)) {
      opn(uri).catch(err => undefined);
    }
  }
}

export default LinkTag;
