import { describe, expect, it } from "vitest";

const state = require("./__mocks__/state.json");

describe("renderer state fixture", () => {
  it("does not reference removed legacy gamestore extensions", () => {
    const extensionVersions = (state as any).app.extensions;

    expect(extensionVersions["gamestore-gog"]).toBeUndefined();
    expect(extensionVersions["gamestore-origin"]).toBeUndefined();
    expect(extensionVersions["gamestore-uplay"]).toBeUndefined();
    expect(extensionVersions["gamestore-xbox"]).toBeUndefined();
  });
});
