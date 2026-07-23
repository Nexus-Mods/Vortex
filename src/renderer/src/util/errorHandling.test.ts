import { recordErrorOnSpan } from "@vortex/shared/telemetry";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IError } from "../types/IError";
import { COMPANY_ID, NEXUSMODS_EXT_ID } from "./constants";
import { genHash } from "./genHash";
import { log } from "./log";

// reportRenderError logs to vortex.log and emits an OTel error span. We assert
// on those two side effects, so stub their leaf dependencies:
//  - ./log captures the log() call
//  - @vortex/shared/telemetry.recordErrorOnSpan is the leaf recordErrorSpan
//    funnels into (a no-op tracer still drives applyErrorToSpan -> here)
//  - ./genHash is mocked so we control which errors are considered duplicates
//  - ./application avoids reading real app state for the version string
vi.mock("./log", () => ({ log: vi.fn() }));
vi.mock("./genHash", () => ({ genHash: vi.fn() }));
vi.mock("./application", () => ({ getApplication: () => ({ version: "1.2.3" }) }));
vi.mock("@vortex/shared/telemetry", () => ({ recordErrorOnSpan: vi.fn() }));

import { reportRenderError, resolveAllowReport } from "./errorHandling";

const errorInfo = { componentStack: "\n    in Foo\n    in Bar" };

describe("reportRenderError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Each test uses unique hashes (see makeHash) so the module-level dedupe
    // Set never carries state across tests.
  });

  // Generate a hash unique to the running test to isolate the shared dedupe Set.
  let hashCounter = 0;
  const makeHash = () => `hash-${++hashCounter}`;

  it("logs the error and component stack to vortex.log", () => {
    vi.mocked(genHash).mockReturnValue(makeHash());
    const error = new Error("boom");

    reportRenderError(error, errorInfo);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("error", "render failure", {
      error: error.stack,
      componentStack: errorInfo.componentStack,
    });
  });

  it("emits an OTel error span", () => {
    vi.mocked(genHash).mockReturnValue(makeHash());
    const error = new Error("boom");

    reportRenderError(error, errorInfo);

    expect(recordErrorOnSpan).toHaveBeenCalledTimes(1);
    const [, recordedError] = vi.mocked(recordErrorOnSpan).mock.calls[0];
    expect(recordedError).toBe(error);
  });

  it("dedupes repeated catches of the same error by hash", () => {
    vi.mocked(genHash).mockReturnValue(makeHash());
    const error = new Error("boom");

    reportRenderError(error, errorInfo);
    reportRenderError(error, errorInfo);
    reportRenderError(error, errorInfo);

    expect(log).toHaveBeenCalledTimes(1);
    expect(recordErrorOnSpan).toHaveBeenCalledTimes(1);
  });

  it("reports distinct errors separately", () => {
    vi.mocked(genHash).mockReturnValueOnce(makeHash()).mockReturnValueOnce(makeHash());

    reportRenderError(new Error("one"), errorInfo);
    reportRenderError(new Error("two"), errorInfo);

    expect(log).toHaveBeenCalledTimes(2);
    expect(recordErrorOnSpan).toHaveBeenCalledTimes(2);
  });

  it("tolerates a missing component stack", () => {
    vi.mocked(genHash).mockReturnValue(makeHash());
    const error = new Error("boom");

    reportRenderError(error, { componentStack: null });

    expect(log).toHaveBeenCalledWith("error", "render failure", {
      error: error.stack,
      componentStack: undefined,
    });
  });
});

describe("resolveAllowReport", () => {
  const err = (extra: Partial<IError>): IError => ({ message: "boom", ...extra }) as IError;

  it("keeps an explicit caller decision regardless of the extension", () => {
    expect(resolveAllowReport(err({ extension: "SomeModder" }), true)).toBe(true);
    expect(resolveAllowReport(err({ extension: COMPANY_ID }), false)).toBe(false);
  });

  it("suppresses reporting when the error opts out", () => {
    expect(resolveAllowReport(err({ allowReport: false }))).toBe(false);
  });

  it("allows reporting for crashes in a first-party extension", () => {
    expect(resolveAllowReport(err({ extension: COMPANY_ID }))).toBe(true);
    expect(resolveAllowReport(err({ extension: NEXUSMODS_EXT_ID }))).toBe(true);
  });

  it("suppresses reporting for crashes in a community extension", () => {
    expect(resolveAllowReport(err({ extension: "SomeModder" }))).toBe(false);
  });

  it("leaves the decision undefined when nothing determines it", () => {
    expect(resolveAllowReport(err({}))).toBeUndefined();
  });
});
