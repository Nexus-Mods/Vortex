import { VortexError } from "@vortex/shared/errors";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: vi.fn(), getVersion: vi.fn() } }));
vi.mock("./logging", () => ({ log: vi.fn() }));
vi.mock("./minidump", () => ({ summarizeMinidumpFile: vi.fn() }));

import { errorToReportableError, isFromCurrentBuild } from "./errorReporting";

describe("errorToReportableError", () => {
  it("renders a VortexError's payload fields legibly in details", () => {
    const err = new VortexError("File not found: C:/games/mod.pak", {
      kind: "fs:not-found",
      path: "C:/games/mod.pak",
    });

    const report = errorToReportableError(err);

    expect(report.details).toContain('"kind":"fs:not-found"');
    expect(report.details).toContain("C:/games/mod.pak");
    expect(report.details).not.toContain("[object Object]");
  });

  it("keeps plain string and boolean props as-is", () => {
    const err = Object.assign(new Error("boom"), { code: "EPERM", allowReport: false });

    const report = errorToReportableError(err);

    expect(report.details).toContain("code: EPERM");
    expect(report.allowReport).toBe(false);
  });
});

describe("isFromCurrentBuild", () => {
  it("keeps only dumps written by the running version", () => {
    expect(isFromCurrentBuild("2.6.3", "2.6.3", 0, 100)).toBe(true);
    expect(isFromCurrentBuild("2.7.0-beta.2", "2.7.0-beta.2", 0, 100)).toBe(true);
    expect(isFromCurrentBuild("2.7.0-beta.1", "2.7.0-beta.2", 200, 100)).toBe(false);
    expect(isFromCurrentBuild("2.0.2", "2.6.3", 200, 100)).toBe(false);
  });

  it("falls back to the install time for unreadable dumps", () => {
    expect(isFromCurrentBuild(undefined, "2.6.3", 50, 100)).toBe(false);
    expect(isFromCurrentBuild(undefined, "2.6.3", 150, 100)).toBe(true);
    expect(isFromCurrentBuild(undefined, "2.6.3", 50, undefined)).toBe(true);
  });
});
