import React from "react";
import { useTranslation } from "react-i18next";

/** A YouTube video, and where to start playing it. */
export interface IYoutubeVideo {
  /** The video's id: 11 of letters, digits, `-` and `_`. */
  id: string;
  /** Seconds into the video to start at, if not the start. */
  start?: number;
}

/** What a YouTube video id looks like: 11 of letters, digits, `-` and `_`. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** A video id on its own, with any options after it, such as `id?t=30`. */
const BARE_ID = /^([A-Za-z0-9_-]{11})(?:[?&#](.*))?$/;

/** A link to YouTube written without its scheme, such as `youtu.be/id`. */
const SCHEMELESS = /^(?:(?:www|m)\.)?(?:youtu\.be|youtube\.com|youtube-nocookie\.com)\//i;

/** YouTube's hosts whose pages name a video by its path or its `v`. */
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** Paths that end in a video id, such as `/embed/id`. */
const VIDEO_PATH = /^\/(?:embed|shorts|live|v)\/([^/]+)/;

/** Seconds in a start time as YouTube writes it, such as `90`, `90s` or `1m30s`. */
const secondsOf = (time: string | null | undefined) => {
  const match = time?.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);

  if (!match) {
    return undefined;
  }

  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) || undefined;
};

/** A video's id and start time from its link's path and options. */
const videoOf = (id: string | null | undefined, options: URLSearchParams) => {
  if (!id || !VIDEO_ID.test(id)) {
    return undefined;
  }

  return { id, start: secondsOf(options.get("t") ?? options.get("start")) };
};

/**
 * The video `raw` names, as written in a `[youtube]` tag: its id, with or without options such as
 * `?t=30`, or a link to it on YouTube. Only the id and start time are kept, so it can't reach
 * another page or add player options.
 */
export const youtubeVideo = (raw: string | undefined): IYoutubeVideo | undefined => {
  const text = raw?.trim();

  if (!text) {
    return undefined;
  }

  const bare = text.match(BARE_ID);
  if (bare) {
    return videoOf(bare[1], new URLSearchParams(bare[2]));
  }

  const href = SCHEMELESS.test(text) ? `https://${text}` : text;
  if (!URL.canParse(href)) {
    return undefined;
  }

  const url = new URL(href);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return undefined;
  }

  const options = new URLSearchParams(url.search);
  new URLSearchParams(url.hash.slice(1)).forEach((value, key) => options.set(key, value));

  if (url.hostname === "youtu.be") {
    return videoOf(url.pathname.slice(1), options);
  }

  if (!YOUTUBE_HOSTS.has(url.hostname)) {
    return undefined;
  }

  return videoOf(
    url.pathname === "/watch" ? options.get("v") : url.pathname.match(VIDEO_PATH)?.[1],
    options,
  );
};

/** The video's page on YouTube. */
export const youtubeWatchUrl = ({ id, start }: IYoutubeVideo) =>
  `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}`;

interface IYoutubeVideoProps {
  /** The video, as `youtubeVideo` reads it. */
  video: IYoutubeVideo;
}

/**
 * A YouTube video in prose, its player embedded from youtube-nocookie.com and loaded as it nears the
 * view. The player can open pop-ups, which is how its own links open, so Vortex opens them in the
 * browser as it does any link that opens a window, but it can't navigate Vortex itself.
 */
export const YoutubeVideo = ({ video: { id, start } }: IYoutubeVideoProps) => {
  const { t } = useTranslation();

  return (
    <span
      className="nxm-prose-video mx-auto block aspect-video max-w-160 overflow-hidden rounded-sm bg-surface-low"
      data-testid="youtube-video"
    >
      <iframe
        allow="encrypted-media; fullscreen; picture-in-picture"
        className="size-full border-0"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        src={`https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ""}`}
        title={t("YouTube video player")}
      />
    </span>
  );
};
