import { Tag } from "bbcode-to-react";
import * as React from "react";

import { ProseImage } from "@/ui/components/prose/prose_image/ProseImage";

/** The sides an image can be put on, as `[img=right]` or `[img align=right]`. */
const ALIGNS = ["left", "center", "right"] as const;

const alignOf = (value: unknown) => ALIGNS.find((align) => align === value);

/** The whole number a parameter starts with, or a pattern finds in it. */
const numberIn = (value: string | undefined, pattern = /^\s*(\d+)/) => {
  const match = pattern.exec(value ?? "");

  if (!match) {
    return undefined;
  }

  return Number(match[1]);
};

/**
 * The size `[img width=300,height=200]` asks for. The parser reads that as one `width` of
 * "300,height=200", so the height is looked for there too.
 */
const sizeOf = (params: Record<string, string | undefined>) => ({
  width: numberIn(params.width),
  height: numberIn(params.height) ?? numberIn(params.width, /height=(\d+)/),
});

/**
 * An image for bbcode we don't write ourselves, drawn by `ProseImage`, so only from Nexus Mods.
 * Its options are read while the parser renders, as they're unset by the time React does.
 */
class SafeImageTag extends Tag {
  public toHTML(): string[] {
    return [];
  }

  public toReact() {
    const { isFromAdultContent } = this.renderer.options;
    const align = alignOf(this.params.align) ?? alignOf(this.params.img);
    const { width, height } = sizeOf(this.params);

    return (
      <ProseImage
        align={align}
        height={height}
        isFromAdultContent={isFromAdultContent}
        src={this.renderer.strip(this.getContent(true))}
        width={width}
      />
    );
  }
}

export default SafeImageTag;
