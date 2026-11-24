import { describe, expect, it } from "vitest";

import { isUrlTarget } from "./isUrlTarget";

describe("isUrlTarget", () => {
  it.each([["https://example.com/page"], ["mailto:someone@example.com"], ["nxm://skyrim/mods/1"]])(
    "treats %s as a url",
    (target) => {
      expect(isUrlTarget(target)).toBe(true);
    },
  );

  it.each([
    ["C:\\Games\\Skyrim"],
    ["C:/Games/Skyrim"],
    ["/home/user/Games/skyrim"],
    ["Data/Mods"],
    ["//example.com/page"],
    [""],
  ])("treats %s as a path", (target) => {
    expect(isUrlTarget(target)).toBe(false);
  });
});
