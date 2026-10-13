import { Tag } from "bbcode-to-react";

/** A tag drawn as nothing, for content that must not be loaded, such as an image or a video. */
class OmittedTag extends Tag {
  public toHTML(): string[] {
    return [];
  }

  public toReact(): React.ReactChild[] {
    return [];
  }
}

export default OmittedTag;
