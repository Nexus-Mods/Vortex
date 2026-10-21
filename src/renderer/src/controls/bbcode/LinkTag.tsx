import * as url from "url";

import { Tag } from "bbcode-to-react";
import * as React from "react";

import opn from "../../util/opn";
import { ErrorContext } from "../ErrorBoundary";

class LinkTag extends Tag {
  public toHTML() {
    let linkUrl = this.renderer.strip(this.params[this.name] || this.getContent(true));
    if (/javascript:/i.test(linkUrl)) {
      linkUrl = "";
    }

    if (!linkUrl || !linkUrl.length) {
      return this.getContent();
    }

    return this.renderer.context({ linkify: false }, () => [
      `<a href="${linkUrl}" target="_blank" title="${linkUrl}">`,
      this.getContent(),
      "</a>",
    ]);
  }

  public toReact() {
    let linkUrl = this.renderer.strip(this.params[this.name] || this.getContent(true));
    if (/javascript:/i.test(linkUrl)) {
      linkUrl = "";
    }

    if (!linkUrl || !linkUrl.length) {
      return this.getComponents();
    }

    if (this.name === "email") {
      linkUrl = `mailto:${linkUrl}`;
    }

    const title = linkUrl.startsWith("cb:") ? undefined : linkUrl;

    const { callbacks, allowLocal } = this.renderer.options;
    // Worked out now: the renderer's options are only set while it renders, not when React does.
    const href = this.href(linkUrl);

    if (href === undefined) {
      return this.getComponents();
    }

    return (
      <ErrorContext.Consumer>
        {(context) => (
          <a
            href={href}
            // tslint:disable-next-line:jsx-no-lambda
            onClick={context.safeCB(
              (evt) => this.clicked(evt, callbacks, allowLocal),
              [this.renderer.options],
            )}
            title={title}
          >
            {this.getComponents()}
          </a>
        )}
      </ErrorContext.Consumer>
    );
  }

  /** The target the link points at. Subclasses can leave it off, so the text is not a link. */
  protected href(linkUrl: string): string | undefined {
    return linkUrl;
  }

  private clicked = (evt: React.MouseEvent<any>, callbacks, allowLocal: boolean) => {
    evt.preventDefault();
    const uri = evt.currentTarget.href;
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      // Invalid URL, don't handle it
      return;
    }
    const protocols = allowLocal ? ["http:", "https:", "file:"] : ["http:", "https:"];

    if (parsed.protocol === "cb:" && callbacks?.[parsed.host] !== undefined) {
      try {
        if (parsed.pathname === "") {
          callbacks[parsed.host]();
        } else {
          const args = parsed.pathname
            .slice(1)
            .split("/")
            .map((seg) => decodeURIComponent(seg));
          callbacks[parsed.host](...args);
        }
      } catch (err) {
        throw new Error(`invalid callback url "${uri}"`, { cause: err });
      }
    } else if (protocols.includes(parsed.protocol)) {
      opn(uri).catch((err) => undefined);
    }
  };
}

export default LinkTag;
