import * as React from "react";

import {
  YoutubeVideo,
  youtubeVideo,
  youtubeWatchUrl,
} from "@/ui/components/prose/youtube_video/YoutubeVideo";

import EmbedLinkTag from "./EmbedLinkTag";

/**
 * `[youtube]` or `[video]`: a player in prose (`isProse`), a link to the video elsewhere. Takes an
 * id, with or without a start time, or a link to the video; anything else goes to `EmbedLinkTag`.
 */
class YoutubeTag extends EmbedLinkTag {
  public toHTML(): string[] {
    const video = youtubeVideo(this.contentText());

    if (!video) {
      return super.toHTML();
    }

    const href = youtubeWatchUrl(video);
    return [`<a href="${href}">${href}</a>`];
  }

  public toReact() {
    const video = youtubeVideo(this.contentText());

    if (!video) {
      return super.toReact();
    }

    if (!this.renderer.options.isProse) {
      const href = youtubeWatchUrl(video);
      return <a href={href}>{href}</a>;
    }

    return <YoutubeVideo video={video} />;
  }
}

export default YoutubeTag;
