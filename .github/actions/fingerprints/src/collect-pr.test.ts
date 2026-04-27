import { beforeEach, describe, expect, it, vi } from "vitest";

const ctx = vi.hoisted(() => ({
  payload: {} as { pull_request?: unknown },
}));

vi.mock("@actions/core", () => ({ info: vi.fn() }));
vi.mock("@actions/github", () => ({ context: ctx }));

const { collectFromPR } = await import("./collect-pr");

const setPR = (body: string | null) => {
  ctx.payload = {
    pull_request: {
      body,
      html_url: "https://github.com/me/repo/pull/1",
      user: { login: "alice" },
    },
  };
};

describe("collectFromPR", () => {
  beforeEach(() => {
    ctx.payload = {};
  });

  it("extracts a single fingerprint from the body", () => {
    setPR("Closes the bug.\n\nFixes fingerprint a1b2c3d4");
    const r = collectFromPR();
    expect(r.dbMode).toBe("insert");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      fingerprint: "a1b2c3d4",
      pr_url: "https://github.com/me/repo/pull/1",
      updated_by: "alice",
      release_version: "",
      status: "fixed",
    });
  });

  it("extracts multiple fingerprints from separate lines", () => {
    setPR("Fixes fingerprint a1b2c3d4\nFixes fingerprint f0e1d2c3");
    expect(collectFromPR().rows.map((r) => r.fingerprint)).toEqual([
      "a1b2c3d4",
      "f0e1d2c3",
    ]);
  });

  it("dedupes repeated fingerprints", () => {
    setPR("Fixes fingerprint a1b2c3d4\nFixes fingerprint a1b2c3d4");
    expect(collectFromPR().rows).toHaveLength(1);
  });

  it("returns no rows when the body has no fingerprints", () => {
    setPR("just a description, nothing to fix");
    expect(collectFromPR().rows).toEqual([]);
  });

  it("handles a null body", () => {
    setPR(null);
    expect(collectFromPR().rows).toEqual([]);
  });

  it("throws when invoked without a pull_request payload", () => {
    ctx.payload = {};
    expect(() => collectFromPR()).toThrow(/pull_request payload/);
  });

  it("only matches at start of line, not mid-line", () => {
    setPR("See: Fixes fingerprint a1b2c3d4 (inline)");
    expect(collectFromPR().rows).toEqual([]);
  });

  it("rejects fingerprints that are too long (no word boundary)", () => {
    setPR("Fixes fingerprint a1b2c3d4e");
    expect(collectFromPR().rows).toEqual([]);
  });

  it("rejects fingerprints that are too short", () => {
    setPR("Fixes fingerprint a1b2c3d");
    expect(collectFromPR().rows).toEqual([]);
  });

  it("rejects non-lowercase-hex characters", () => {
    setPR("Fixes fingerprint A1B2C3D4");
    expect(collectFromPR().rows).toEqual([]);
  });
});
