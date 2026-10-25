import { describe, expect, it } from "vitest";

import { shouldClaimNxmLinks } from "./nxmAssociation";

describe("shouldClaimNxmLinks", () => {
  it("does not take over nxm:// links on first start", () => {
    expect(shouldClaimNxmLinks(undefined)).toBe(false);
  });

  it("only claims them after the user turns the setting on", () => {
    expect(shouldClaimNxmLinks(false)).toBe(false);
    expect(shouldClaimNxmLinks(true)).toBe(true);
  });
});
