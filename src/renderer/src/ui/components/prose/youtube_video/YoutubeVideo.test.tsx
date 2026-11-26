import { render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { YoutubeVideo, youtubeVideo, youtubeWatchUrl } from "./YoutubeVideo";

describe("youtubeVideo", () => {
  it.each([
    [" dQw4w9WgXcQ ", { id: "dQw4w9WgXcQ" }],
    ["a-b_c-d_e-f", { id: "a-b_c-d_e-f" }],
    ["dQw4w9WgXcQ?t=30", { id: "dQw4w9WgXcQ", start: 30 }],
    ["dQw4w9WgXcQ&t=1m30s", { id: "dQw4w9WgXcQ", start: 90 }],
    ["dQw4w9WgXcQ?autoplay=1", { id: "dQw4w9WgXcQ" }],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x", { id: "dQw4w9WgXcQ" }],
    ["https://youtu.be/dQw4w9WgXcQ?t=42", { id: "dQw4w9WgXcQ", start: 42 }],
    ["youtu.be/dQw4w9WgXcQ", { id: "dQw4w9WgXcQ" }],
    ["www.youtube.com/watch?v=dQw4w9WgXcQ#t=1h", { id: "dQw4w9WgXcQ", start: 3600 }],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", { id: "dQw4w9WgXcQ" }],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=5", { id: "dQw4w9WgXcQ", start: 5 }],
  ])("reads %s", (raw, video) => {
    expect(youtubeVideo(raw)).toEqual({ start: undefined, ...video });
  });

  it.each([
    undefined,
    "",
    "abc123",
    "../../watch",
    'dQw4w9WgXc"',
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "javascript://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=abc123",
    "https://www.youtube.com/channel/dQw4w9WgXcQ",
  ])("refuses %s", (raw) => {
    expect(youtubeVideo(raw)).toBeUndefined();
  });
});

describe("youtubeWatchUrl", () => {
  it("links the video's page, from its start time", () => {
    expect(youtubeWatchUrl({ id: "dQw4w9WgXcQ" })).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(youtubeWatchUrl({ id: "dQw4w9WgXcQ", start: 30 })).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    );
  });
});

describe("YoutubeVideo", () => {
  it("embeds the player, sandboxed so it can open pop-ups but not navigate", () => {
    const { container } = render(<YoutubeVideo video={{ id: "dQw4w9WgXcQ" }} />);

    const player = container.querySelector("iframe");
    expect(player).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(player).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-presentation allow-popups",
    );
    expect(player).toHaveAttribute("loading", "lazy");
  });

  it("starts the player at the video's start time", () => {
    const { container } = render(<YoutubeVideo video={{ id: "dQw4w9WgXcQ", start: 30 }} />);

    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=30",
    );
  });
});
