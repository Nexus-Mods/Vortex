import { describe, it, expect } from "vitest";

import safeCreateAction from "./safeCreateAction";

describe("safeCreateAction", () => {
  it("creates the action creator", () => {
    const creator = safeCreateAction("ACTION", () => undefined);
    expect(typeof creator).toBe("function");
  });
  it("replaces action creator", () => {
    const c1 = safeCreateAction("ACTION", (_unused: void) => ({ key: "old" }));
    expect(c1(undefined)).toEqual({
      error: false,
      type: "ACTION",
      payload: { key: "old" },
    });
    const c2 = safeCreateAction("ACTION", (_unused: void) => ({ key: "new" }));
    expect(c2(undefined)).toEqual({
      error: false,
      type: "ACTION",
      payload: { key: "new" },
    });
  });
});
