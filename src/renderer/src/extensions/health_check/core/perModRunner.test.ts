import * as fs from "fs";

import { afterEach, describe, test, expect, vi } from "vitest";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import {
  HealthCheckCategory,
  HealthCheckSeverity,
  HealthCheckTrigger,
  type IModCheckContext,
  type IModHealthCheck,
} from "../../../types/IHealthCheck";
import { aggregateResults, buildModCheckContext, runPerModCheck } from "./perModRunner";

const baseResult = (
  status: "passed" | "failed" | "warning" | "error",
  severity: HealthCheckSeverity,
  message = "",
) => ({
  checkId: "x",
  status,
  severity,
  message,
  executionTime: 0,
  timestamp: new Date(0),
});

describe("aggregateResults", () => {
  test("all-clean → passed/info", () => {
    const r = aggregateResults(
      "agg",
      [
        baseResult("passed", HealthCheckSeverity.Info),
        baseResult("passed", HealthCheckSeverity.Info),
      ],
      0,
    );
    expect(r.status).toBe("passed");
    expect(r.severity).toBe(HealthCheckSeverity.Info);
    expect(r.message).toContain("2 mods checked");
  });

  test("any failure escalates status and severity", () => {
    const r = aggregateResults(
      "agg",
      [
        baseResult("passed", HealthCheckSeverity.Info),
        baseResult("failed", HealthCheckSeverity.Error, "broken"),
      ],
      0,
    );
    expect(r.status).toBe("failed");
    expect(r.severity).toBe(HealthCheckSeverity.Error);
    expect(r.details).toContain("broken");
  });

  test("worst severity wins even if status is the same", () => {
    const r = aggregateResults(
      "agg",
      [
        baseResult("warning", HealthCheckSeverity.Warning),
        baseResult("warning", HealthCheckSeverity.Critical),
      ],
      0,
    );
    expect(r.severity).toBe(HealthCheckSeverity.Critical);
  });

  test("warnings without failures → status warning", () => {
    const r = aggregateResults(
      "agg",
      [
        baseResult("passed", HealthCheckSeverity.Info),
        baseResult("warning", HealthCheckSeverity.Warning, "outdated"),
      ],
      0,
    );
    expect(r.status).toBe("warning");
    expect(r.severity).toBe(HealthCheckSeverity.Warning);
    expect(r.details).toMatch(/\[warning\].*outdated/);
  });

  test("empty results → passed", () => {
    const r = aggregateResults("agg", [], 0);
    expect(r.status).toBe("passed");
  });
});

describe("runPerModCheck error handling", () => {
  const fakeApi = {} as IExtensionApi;

  const makeCheck = (
    checkMod: (api: IExtensionApi, mod: IModCheckContext) => Promise<any>,
  ): IModHealthCheck => ({
    id: "test-check",
    name: "Test",
    description: "",
    category: HealthCheckCategory.Mods,
    severity: HealthCheckSeverity.Warning,
    triggers: [HealthCheckTrigger.Manual],
    checkMod,
  });

  const emptyContext: IModCheckContext = {
    modId: "m1",
    files: [],
    readFile: async () => Buffer.alloc(0),
    attributes: {},
  };

  test("checkMod throw is converted to an error-status result (not propagated)", async () => {
    const hc = makeCheck(async () => {
      throw new Error("boom in extension code");
    });
    const result = await runPerModCheck(hc, fakeApi, {
      enumerate: () => [{ modId: "m1", stagingPath: "/fake", attributes: {} }],
      buildContext: async () => emptyContext,
    });
    expect(result.status).toBe("failed");
    expect(result.severity).toBe(HealthCheckSeverity.Error);
    expect(result.details).toMatch(/checkMod threw for m1.*boom/);
  });

  test("buildModCheckContext throw propagates (harness bug, not extension)", async () => {
    const hc = makeCheck(async () => ({
      checkId: "test-check",
      status: "passed" as const,
      severity: HealthCheckSeverity.Info,
      message: "ok",
      executionTime: 0,
      timestamp: new Date(),
    }));

    await expect(
      runPerModCheck(hc, fakeApi, {
        enumerate: () => [{ modId: "m1", stagingPath: "/fake", attributes: {} }],
        buildContext: async () => {
          throw new Error("EACCES walking staging dir");
        },
      }),
    ).rejects.toThrow(/EACCES/);
  });

  test("no mods → passed/info short-circuit", async () => {
    const hc = makeCheck(async () => {
      throw new Error("should not run");
    });
    const result = await runPerModCheck(hc, fakeApi, {
      enumerate: () => [],
      buildContext: async () => emptyContext,
    });
    expect(result.status).toBe("passed");
    expect(result.severity).toBe(HealthCheckSeverity.Info);
  });
});

describe("buildModCheckContext", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // If the mod is uninstalled between enumeration and FS walk, fs.access fails;
  // the runner currently logs and returns an empty file list, so the check sees
  // a mod with no files rather than blowing up the whole run.
  test("missing staging dir yields empty files list (no throw)", async () => {
    const accessSpy = vi
      .spyOn(fs.promises, "access")
      .mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const ctx = await buildModCheckContext({
      modId: "ghost",
      stagingPath: "/nonexistent/path",
      attributes: { v: 1 },
    });

    expect(accessSpy).toHaveBeenCalled();
    expect(ctx.modId).toBe("ghost");
    expect(ctx.files).toEqual([]);
    expect(ctx.attributes).toEqual({ v: 1 });
  });
});
