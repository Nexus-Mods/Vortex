import { GameDomain } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { makeGameStored } from "@/test-utils/builders";

import { convertGameIdReverse, convertNXMIdReverse, extensionlessGameId } from "./convertGameId";

// skyrimvr shares skyrimse's nexus page, the way the bundled extensions register them
const known = [
  makeGameStored(),
  makeGameStored({ id: "skyrimvr", details: { nexusPageId: "skyrimspecialedition" } }),
  makeGameStored({ id: "stardewvalley", details: { nxmLinkId: "stardew" } }),
];

describe("convertGameIdReverse", () => {
  it("prefers the game whose id is the input", () => {
    expect(convertGameIdReverse(known, "SkyrimVR")).toBe("skyrimvr");
  });

  it("maps a nexus page id to the first game registered for it", () => {
    expect(convertGameIdReverse(known, "skyrimspecialedition")).toBe("skyrimse");
  });

  it("falls back to the hardcoded mapping without a known game", () => {
    expect(convertGameIdReverse([], "newvegas")).toBe("falloutnv");
  });

  it("falls back to the lowercased input for a game it doesn't know", () => {
    expect(convertGameIdReverse([], "SomeGame")).toBe("somegame");
  });

  it("has no id for an empty or missing input", () => {
    expect(convertGameIdReverse(known, "")).toBeUndefined();
    expect(convertGameIdReverse(known, undefined)).toBeUndefined();
  });
});

describe("convertNXMIdReverse", () => {
  it("prefers the game whose id is the input", () => {
    expect(convertNXMIdReverse(known, "SkyrimSE")).toBe("skyrimse");
  });

  it("maps an nxm link id to its game", () => {
    expect(convertNXMIdReverse(known, "stardew")).toBe("stardewvalley");
  });

  it("falls back to the lowercased input for a game it doesn't know", () => {
    expect(convertNXMIdReverse([], "SomeGame")).toBe("somegame");
  });

  it("has no id for an empty or missing input", () => {
    expect(convertNXMIdReverse(known, "")).toBeUndefined();
    expect(convertNXMIdReverse(known, undefined)).toBeUndefined();
  });
});

describe("extensionlessGameId", () => {
  it("is the game's nexus domain", () => {
    expect(extensionlessGameId(GameDomain("hollowknight"))).toBe("hollowknight");
  });
});
