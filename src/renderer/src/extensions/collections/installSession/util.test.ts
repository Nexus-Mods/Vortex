import { describe, expect, it } from "vitest";

import type { IModRule } from "../../mod_management/types/IMod";
import { reconstructModStatus } from "./util";

function makeRule(overrides: Partial<IModRule> = {}): IModRule {
  return {
    type: "requires",
    reference: { tag: "abc" },
    ...overrides,
  };
}

describe("reconstructModStatus", () => {
  it('rehydrates an ignored rule as the terminal "ignored" status so a skip survives a restart', () => {
    // The durable `ignored` flag is the only record of a skip once the session is
    // gone; without this, a skipped required mod would come back as "pending" and
    // the collection could never reach completion.
    expect(reconstructModStatus(makeRule({ ignored: true }), false, false)).toBe("ignored");
  });

  it('"ignored" takes precedence over "installed"', () => {
    expect(reconstructModStatus(makeRule({ ignored: true }), true, true)).toBe("ignored");
  });

  it('rehydrates an installed (non-ignored) rule as "installed"', () => {
    expect(reconstructModStatus(makeRule(), true, false)).toBe("installed");
  });

  it('rehydrates a downloaded-but-not-installed rule as "downloaded"', () => {
    expect(reconstructModStatus(makeRule(), false, true)).toBe("downloaded");
  });

  it('rehydrates an untouched rule as "pending"', () => {
    expect(reconstructModStatus(makeRule(), false, false)).toBe("pending");
  });

  it("treats ignored === false the same as absent (not ignored)", () => {
    expect(reconstructModStatus(makeRule({ ignored: false }), true, false)).toBe("installed");
  });
});
