import { beforeEach, describe, expect, it, vi } from "vitest";

const inputs = vi.hoisted(() => ({
  fingerprints: "",
  remove: "false",
  status: "fixed",
  "release-version": "",
}));

const ctx = vi.hoisted(() => ({
  payload: {},
  repo: { owner: "org", repo: "repo" },
  serverUrl: "https://github.com",
  runId: 42,
  actor: "tester",
}));

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  getInput: vi.fn((name: string) => (inputs as Record<string, string>)[name] ?? ""),
  getBooleanInput: vi.fn((name: string) => (inputs as Record<string, string>)[name] === "true"),
}));

vi.mock("@actions/github", () => ({ context: ctx }));

const { collectFromInput } = await import("./collect-input");

describe("collectFromInput", () => {
  beforeEach(() => {
    inputs.fingerprints = "";
    inputs.remove = "false";
    inputs.status = "fixed";
    inputs["release-version"] = "";
  });

  it("parses comma-separated fingerprints", () => {
    inputs.fingerprints = "a1b2c3d4,f0e1d2c3";
    const r = collectFromInput();
    expect(r.dbMode).toBe("insert");
    expect(r.rows.map((x) => x.fingerprint)).toEqual(["a1b2c3d4", "f0e1d2c3"]);
  });

  it("parses whitespace-separated fingerprints (spaces and newlines)", () => {
    inputs.fingerprints = "a1b2c3d4 f0e1d2c3\n12345678";
    const r = collectFromInput();
    expect(r.rows.map((x) => x.fingerprint).sort()).toEqual(["12345678", "a1b2c3d4", "f0e1d2c3"]);
  });

  it("dedupes repeated fingerprints", () => {
    inputs.fingerprints = "a1b2c3d4,a1b2c3d4,a1b2c3d4";
    expect(collectFromInput().rows).toHaveLength(1);
  });

  it("rejects fingerprints that are not 8 lowercase hex chars", () => {
    inputs.fingerprints = "a1b2c3d4,XYZ12345";
    expect(() => collectFromInput()).toThrow(/Invalid fingerprint/);
  });

  it("rejects when no usable fingerprints provided", () => {
    inputs.fingerprints = "   ,  ";
    expect(() => collectFromInput()).toThrow(/No fingerprints provided/);
  });

  it("requires release-version when adding with status=released", () => {
    inputs.fingerprints = "a1b2c3d4";
    inputs.status = "released";
    expect(() => collectFromInput()).toThrow(/release-version is required/);
  });

  it("does not require release-version when removing", () => {
    inputs.fingerprints = "a1b2c3d4";
    inputs.status = "released";
    inputs.remove = "true";
    expect(collectFromInput().dbMode).toBe("delete");
  });

  it("rejects an unknown status value", () => {
    inputs.fingerprints = "a1b2c3d4";
    inputs.status = "pending";
    expect(() => collectFromInput()).toThrow(/Invalid status/);
  });

  it("accepts uppercase hex and normalizes to lowercase", () => {
    inputs.fingerprints = "A1B2C3D4,F0E1D2C3";
    const r = collectFromInput();
    expect(r.rows.map((x) => x.fingerprint)).toEqual(["a1b2c3d4", "f0e1d2c3"]);
  });

  it("accepts status=ignored without requiring release-version", () => {
    inputs.fingerprints = "a1b2c3d4";
    inputs.status = "ignored";
    const r = collectFromInput();
    expect(r.dbMode).toBe("insert");
    expect(r.rows[0].status).toBe("ignored");
    expect(r.rows[0].release_version).toBe("");
  });

  it("stamps each row with the workflow run URL and the actor", () => {
    inputs.fingerprints = "a1b2c3d4";
    const r = collectFromInput();
    expect(r.rows[0].pr_url).toBe("https://github.com/org/repo/actions/runs/42");
    expect(r.rows[0].updated_by).toBe("tester");
    expect(r.rows[0].status).toBe("fixed");
  });
});
