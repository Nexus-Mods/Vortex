import { VortexError } from "@vortex/shared/errors";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: vi.fn(), getVersion: vi.fn() } }));
vi.mock("./logging", () => ({ log: vi.fn() }));
vi.mock("./minidump", () => ({ summarizeMinidumpFile: vi.fn() }));

import { crashFingerprint, errorToReportableError } from "./errorReporting";

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

describe("crashFingerprint", () => {
  const nativeCrash = (overrides: Record<string, string | number> = {}) =>
    crashFingerprint(
      "2.7.0",
      "PreviousSessionCrash",
      { message: "Previous session crashed", code: "0xc0000005" },
      {
        "crash.sourceProcess": "main",
        "crash.native.exceptionCode": "0xc0000005",
        "crash.native.module": "Vortex.exe",
        "crash.native.moduleOffset": "0x398fe0",
        "crash.native.exceptionAddress": "0x7ff782a98fe0",
        "crash.native.dumpCount": 1,
        ...overrides,
      },
    );

  it("is an 8-char hex hash", () => {
    expect(nativeCrash()).toMatch(/^[0-9a-f]{8}$/);
  });

  it("groups the same native crash site regardless of address and dump count", () => {
    expect(
      nativeCrash({ "crash.native.exceptionAddress": "0x1", "crash.native.dumpCount": 3 }),
    ).toBe(nativeCrash());
  });

  it("separates crash sites by module offset", () => {
    expect(nativeCrash({ "crash.native.moduleOffset": "0x6d3aff9" })).not.toBe(nativeCrash());
  });

  it("separates gone processes by exit code and process", () => {
    const gone = (sourceProcess: string, exitCode: number) =>
      crashFingerprint(
        "2.7.0",
        "ChildProcessGone",
        { message: "process gone", code: "crashed" },
        { "crash.sourceProcess": sourceProcess, "crash.exitCode": exitCode },
      );

    expect(gone("utility", -1073741205)).toBe(gone("utility", -1073741205));
    expect(gone("utility", -1073741205)).not.toBe(gone("utility", 133));
    expect(gone("utility", 133)).not.toBe(gone("gpu", 133));
  });

  it("changes with the app version, like stack fingerprints do", () => {
    const withVersion = (version: string) =>
      crashFingerprint(version, "EarlyCrash", { message: "boom" }, {});
    expect(withVersion("2.7.0")).not.toBe(withVersion("2.7.1"));
  });
});
