import { describe, expect, it } from "vitest";

import { webImageSrc } from "./webImageSrc";

describe("webImageSrc", () => {
  it.each([
    "https://staticdelivery.nexusmods.com/mods/1704/images/3863/3863-1.png",
    "https://images.nexusmods.com/a.jpg",
    "https://nexusmods.com/a.jpg",
  ])("keeps %s", (src) => {
    expect(webImageSrc(src)).toBe(src);
  });

  it.each([
    ["another site", "https://i.imgur.com/a.png"],
    ["a lookalike host", "https://evilnexusmods.com/a.png"],
    ["a host that only starts like it", "https://nexusmods.com.example.com/a.png"],
    ["credentials before another host", "https://nexusmods.com@example.com/a.png"],
    ["plain http", "http://staticdelivery.nexusmods.com/a.png"],
    ["a file", "file:///C:/Users/me/a.png"],
    ["a network path", "\\\\example.com\\share\\a.png"],
    ["a file on a network share", "file://example.com/share/a.png"],
    ["data", "data:image/png;base64,iVBORw0KGgo="],
    ["a custom protocol", "nxm://skyrimspecialedition/mods/1"],
    ["a relative path", "/a.png"],
  ])("drops %s", (_, src) => {
    expect(webImageSrc(src)).toBeUndefined();
  });

  describe("with any domain allowed", () => {
    it("keeps an https image from another site", () => {
      const src = "https://github.com/user-attachments/assets/a.png";

      expect(webImageSrc(src, { allowAnyDomain: true })).toBe(src);
    });

    it.each([
      ["plain http", "http://example.com/a.png"],
      ["a file", "file:///C:/Users/me/a.png"],
      ["a network path", "\\\\example.com\\share\\a.png"],
      ["data", "data:image/png;base64,iVBORw0KGgo="],
    ])("still drops %s", (_, src) => {
      expect(webImageSrc(src, { allowAnyDomain: true })).toBeUndefined();
    });
  });

  it("drops nothing", () => {
    expect(webImageSrc(undefined)).toBeUndefined();
    expect(webImageSrc("")).toBeUndefined();
  });
});
