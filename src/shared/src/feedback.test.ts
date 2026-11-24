import { describe, expect, it } from "vitest";

import { isBundledLogFile } from "./feedback";

describe("isBundledLogFile", () => {
  it("takes the vortex logs and the network log", () => {
    expect(isBundledLogFile("vortex.log")).toBe(true);
    expect(isBundledLogFile("vortex4.log")).toBe(true);
    expect(isBundledLogFile("network.log")).toBe(true);
  });

  it("leaves everything else alone", () => {
    expect(isBundledLogFile("vortex10.log")).toBe(false);
    expect(isBundledLogFile("unrelated.log")).toBe(false);
    expect(isBundledLogFile("startup.log")).toBe(false);
  });
});
