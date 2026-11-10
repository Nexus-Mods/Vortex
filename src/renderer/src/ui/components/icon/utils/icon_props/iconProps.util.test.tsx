import React from "react";
import { describe, expect, it } from "vitest";

import type { IIconProp } from "../../Icon";
import { getIconProps, isIconSource } from "./iconProps.util";

describe("isIconSource", () => {
  it.each([
    ["a symbol's name", "settings"],
    ["a symbol with its axes", { name: "star", filled: true }],
    ["an SVG path", { path: "M0 0h24v24H0z" }],
  ] as const)("takes %s as a source", (_, icon) => {
    expect(isIconSource(icon)).toBe(true);
  });

  it.each([
    ["an element", <span key="a" />],
    ["nothing", undefined],
  ])("takes %s as an element, not a source", (_, icon) => {
    expect(isIconSource(icon)).toBe(false);
  });

  it("takes no name the font doesn't have", () => {
    // @ts-expect-error a misspelled symbol is neither a source nor an element
    const icon: IIconProp = "serach";

    expect(icon).toBe("serach");
  });
});

describe("getIconProps", () => {
  it("turns a name into the props that draw it", () => {
    expect(getIconProps("settings")).toEqual({ name: "settings" });
  });

  it("passes an object on as it is", () => {
    const source = { name: "star", filled: true } as const;
    expect(getIconProps(source)).toBe(source);
  });
});
