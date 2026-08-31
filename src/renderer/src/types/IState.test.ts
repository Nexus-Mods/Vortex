import { describe, expect, it } from "vitest";

import { toUpdateChannel } from "./IState";

describe("toUpdateChannel", () => {
  it("passes through the valid channels", () => {
    expect(toUpdateChannel("stable")).toBe("stable");
    expect(toUpdateChannel("beta")).toBe("beta");
    expect(toUpdateChannel("none")).toBe("none");
  });

  // "next" existed for years as a second name for beta and was retired; an install that still
  // has it persisted must read as stable rather than carry the dead value around
  it("reads a retired or unknown channel as stable", () => {
    expect(toUpdateChannel("next")).toBe("stable");
    expect(toUpdateChannel("nonsense")).toBe("stable");
    expect(toUpdateChannel(undefined)).toBe("stable");
    expect(toUpdateChannel(null)).toBe("stable");
  });
});
