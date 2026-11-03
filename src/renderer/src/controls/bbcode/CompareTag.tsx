import { Tag } from "bbcode-to-react";
import * as React from "react";

import { ProseImage } from "@/ui/components/prose/prose_image/ProseImage";

/**
 * A before and after comparison, `[compare before=url]url[/compare]`, as its two images one over
 * the other; the site's slider between them isn't drawn.
 */
class CompareTag extends Tag {
  public toHTML(): string[] {
    return [];
  }

  public toReact() {
    const { isFromAdultContent } = this.renderer.options;

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
}

export default CompareTag;
