import { Tag } from "bbcode-to-react";
import * as React from "react";

import { CompareSlider } from "@/ui/components/compare_slider/CompareSlider";
import { ProseImage } from "@/ui/components/prose/prose_image/ProseImage";
import { numberIn, pixels } from "@/ui/utils/image_size/imageSize";
import { webImageSrc } from "@/ui/utils/web_image_src/webImageSrc";

import { externalSourcesPlaceholderFor } from "./externalImages";

/**
 * A before and after comparison, `[compare before=url width=px]url[/compare]`, as the site's
 * slider between its two images, unframed as other images in prose are, no wider than the width
 * it gives, capped as an image's is. It sits on a line of its own, aligned as that line is. With an
 * image from outside Nexus Mods, which isn't drawn, it's its two images one over the other, the
 * outside one a placeholder where the bbcode's context asks for them, so the other still shows.
 * Its options are read while the parser renders, as they're unset by the time React does.
 */
class CompareTag extends Tag {
  public toHTML(): string[] {
    return [];
  }

  public toReact() {
    const { isFromAdultContent = false } = this.renderer.options;
    const sources = [this.params.before, this.renderer.strip(this.getContent(true))];
    const [before, after] = sources.map((src) => webImageSrc(src));

    if (!before || !after) {
      return (
        <>
          <ProseImage isFromAdultContent={isFromAdultContent} src={before} />

          {externalSourcesPlaceholderFor(this, sources)}

          <ProseImage isFromAdultContent={isFromAdultContent} src={after} />
        </>
      );
    }

    const width = pixels(numberIn(this.params.width));

    return (
      <div className="nxm-prose-compare">
        <div className="nxm-prose-compare-slider" style={{ maxWidth: width && `${width}px` }}>
          <CompareSlider
            after={{ src: after }}
            before={{ src: before }}
            isAdult={isFromAdultContent}
            isStyled={false}
          />
        </div>
      </div>
    );
  }
}

export default CompareTag;
