import { VortexError } from "@vortex/shared/errors";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getPath: vi.fn(), getVersion: vi.fn() } }));
vi.mock("./logging", () => ({ log: vi.fn() }));
vi.mock("./minidump", () => ({ summarizeMinidumpFile: vi.fn() }));

import { errorToReportableError } from "./errorReporting";

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
