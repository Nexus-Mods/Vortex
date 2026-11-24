import * as React from "react";

import {
  YoutubeVideo,
  youtubeVideo,
  youtubeWatchUrl,
} from "@/ui/components/prose/youtube_video/YoutubeVideo";

import EmbedLinkTag from "./EmbedLinkTag";

/**
 * `[youtube]`, or the site's `[video]`, as a video player where the context's `embedVideos` asks,
 * otherwise a link to the video. It takes a video id, with or without a start time, or a link to
 * the video. Anything else is a link or text, as `EmbedLinkTag` draws it, and as HTML, nothing.
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

    if (!this.renderer.options.embedVideos) {
      const href = youtubeWatchUrl(video);
      return <a href={href}>{href}</a>;
    }

    return <YoutubeVideo video={video} />;
  }
}

export default YoutubeTag;
