import { Tag } from "bbcode-to-react";
import * as React from "react";

import { CompareSlider } from "@/ui/components/compare_slider/CompareSlider";
import { ProseImage } from "@/ui/components/prose/prose_image/ProseImage";
import { webImageSrc } from "@/ui/utils/web_image_src/webImageSrc";

/**
 * A before and after comparison, `[compare before=url width=px]url[/compare]`, as the site's
 * slider between its two images, no wider than the width it gives. With an image from outside
 * Nexus Mods, which isn't drawn, it's its two images one over the other, so the other still shows.
 * Its options are read while the parser renders, as they're unset by the time React does.
 */
class CompareTag extends Tag {
  public toHTML(): string[] {
    return [];
  }

  public toReact() {
    const { isFromAdultContent = false } = this.renderer.options;
    const before = webImageSrc(this.params.before);
    const after = webImageSrc(this.renderer.strip(this.getContent(true)));

    if (!before || !after) {
      return (
        <>
          <ProseImage isFromAdultContent={isFromAdultContent} src={this.params.before} />

          <ProseImage
            isFromAdultContent={isFromAdultContent}
            src={this.renderer.strip(this.getContent(true))}
          />
        </>
      );
    }

    const width = Number.parseInt(this.params.width ?? "", 10);

    return (
      <div className="my-2" style={{ maxWidth: width > 0 ? `${width}px` : undefined }}>
        <CompareSlider
          after={{ src: after }}
          before={{ src: before }}
          isAdult={isFromAdultContent}
        />
      </div>
    );
  }
}

export default CompareTag;
