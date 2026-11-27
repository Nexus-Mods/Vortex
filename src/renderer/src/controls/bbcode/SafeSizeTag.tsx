import React, { type ReactChild } from "react";

import SizeTag from "./SizeTag";

/** The site's older percentage sizes, as the sizes it now draws them at. */
const PERCENTAGES: Record<number, number> = { 50: 1, 85: 2, 100: 3, 150: 4, 200: 6 };

/** The site's size, 1 to 6, that `size` stands for; the text's own, 3, if none. */
const levelOf = (size: number | string) => {
  const level = PERCENTAGES[Number(size)] ?? Number(size);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 3;
};

/**
 * A size in bbcode we don't write ourselves, as one of the app's text sizes, so sizes left open
 * don't compound. Only in prose (`isProse`); elsewhere the text keeps its size.
 */
class SafeSizeTag extends SizeTag {
  /** As HTML, such as inside a tag that reads its contents as text, the text without its size. */
  public toHTML(): string[] {
    return [this.getContent()];
  }

  public toReact(): ReactChild[] {
    const size = this.params.size;

    if (isNaN(size) || !this.renderer.options.isProse) {
      return this.getComponents();
    }

    return [<span className={`nxm-prose-size-${levelOf(size)}`}>{this.getComponents()}</span>];
  }
}

export default SafeSizeTag;
