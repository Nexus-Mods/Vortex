import * as React from "react";

import SizeTag from "./SizeTag";

/** The site's older percentage sizes, as the sizes it now draws them at. */
const PERCENTAGES: Record<number, number> = { 50: 1, 85: 2, 100: 3, 150: 4, 200: 6 };

/** The site's size, 1 to 6, that `size` stands for; the text's own, 3, if none. */
const levelOf = (size: number | string) => {
  const level = PERCENTAGES[Number(size)] ?? Number(size);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? level : 3;
};

/**
 * A size for bbcode we don't write ourselves, drawn by `.nxm-prose-size-<size>` as one of the app's
 * text sizes, so a size left open or inside another doesn't shrink or grow what follows, as on the
 * site, where the context's `isProse` says it's prose; otherwise at the size of the text around it.
 */
class SafeSizeTag extends SizeTag {
  public toReact(): React.ReactChild[] {
    const size = this.params.size;

    if (isNaN(size) || !this.renderer.options.isProse) {
      return this.getComponents();
    }

    return [<span className={`nxm-prose-size-${levelOf(size)}`}>{this.getComponents()}</span>];
  }
}

export default SafeSizeTag;
