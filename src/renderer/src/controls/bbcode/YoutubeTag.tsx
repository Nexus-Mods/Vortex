import { Tag } from "bbcode-to-react";
import * as React from "react";

class YoutubeTag extends Tag {
  public toHTML(): string[] {
    return [
      `<iframe src="https://www.youtube-nocookie.com/embed/${this.getContent()}" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; web-share" title="YouTube video player"/>`,
    ];
  }

  public toReact() {
    return (
      <div className="youtube-embed-container">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${this.getContent()}`}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="encrypted-media; web-share"
          title="YouTube video player"
        />
        <p className="youtube-privacy-notice">
          Playing this video will store cookies on your device
        </p>
      </div>
    );
  }
}

export default YoutubeTag;
