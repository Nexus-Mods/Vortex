import * as fs from "fs";

import { afterEach, describe, test, expect, vi } from "vitest";

import {
  makeConcurrencyProbe,
  makeHealthCheckResult,
  makeModCheckContext,
  makeModHealthCheck,
} from "../../../test-utils/builders";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import { HealthCheckSeverity } from "../../../types/IHealthCheck";
import type { IInstalledModEntry } from "./perModRunner";
import {
  aggregateResults,
  buildModCheckContext,
  MOD_WALK_CONCURRENCY,
  runPerModCheck,
} from "./perModRunner";

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
  const emptyContext = makeModCheckContext({ modId: "m1" });

  test("checkMod throw is converted to an error-status result (not propagated)", async () => {
    const hc = makeModHealthCheck({
      checkMod: async () => {
        throw new Error("boom in extension code");
      },
    });
    const result = await runPerModCheck(hc, fakeApi, {
      enumerate: () => [{ modId: "m1", stagingPath: "/fake", attributes: {} }],
      buildContext: async () => emptyContext,
    });
    expect(result.status).toBe("failed");
    expect(result.severity).toBe(HealthCheckSeverity.Error);
    expect(result.details).toMatch(/checkMod threw for m1.*boom/);
  });

  test("buildModCheckContext throw is reported against its mod (not propagated)", async () => {
    const hc = makeModHealthCheck();

    const result = await runPerModCheck(hc, fakeApi, {
      enumerate: () => [{ modId: "m1", stagingPath: "/fake", attributes: {} }],
      buildContext: async () => {
        throw new Error("EACCES walking staging dir");
      },
    });

    expect(result.status).toBe("failed");
    expect(result.severity).toBe(HealthCheckSeverity.Error);
    expect(result.details).toMatch(/Could not read staging folder for m1.*EACCES/);
  });

  test("one unreadable mod does not discard the rest of the run", async () => {
    const hc = makeModHealthCheck({
      checkMod: async (_api, mod) => makeHealthCheckResult({ message: `checked ${mod.modId}` }),
    });

    const result = await runPerModCheck(hc, fakeApi, {
      enumerate: () =>
        ["m1", "locked", "m3"].map((modId) => ({
          modId,
          stagingPath: `/fake/${modId}`,
          attributes: {},
        })),
      buildContext: async (entry) => {
        if (entry.modId === "locked") {
          throw new Error("EPERM: file is locked");
        }
        return makeModCheckContext({ modId: entry.modId });
      },
    });

    expect(result.message).toContain("1 failed / 0 warned of 3 mods");
    expect(result.details).toMatch(/Could not read staging folder for locked.*EPERM/);
  });

  test("no mods → passed/info short-circuit", async () => {
    const hc = makeModHealthCheck({
      checkMod: async () => {
        throw new Error("should not run");
      },
    });
    const result = await runPerModCheck(hc, fakeApi, {
      enumerate: () => [],
      buildContext: async () => emptyContext,
    });
    expect(result.status).toBe("passed");
    expect(result.severity).toBe(HealthCheckSeverity.Info);
  });
});

/** How wide the runner goes on a large library (GH#23776). */
describe("runPerModCheck fan-out", () => {
  const fakeApi = {} as IExtensionApi;

  // Loose enough to survive retuning MOD_WALK_CONCURRENCY, tight enough that an unbounded walk
  // of the libraries below blows through it.
  const CONCURRENCY_CEILING = 64;

  // A microtask, not a timer: enough to make the pool's tasks overlap, which is all the probe
  // measures, and off the timer queue so CI load cannot change the result.
  const tick = () => Promise.resolve();

  const entries = (count: number): IInstalledModEntry[] =>
    Array.from({ length: count }, (_, i) => ({
      modId: `mod-${i}`,
      stagingPath: `/staging/mod-${i}`,
      attributes: {},
    }));

  // Peak contexts built but not yet released by checkMod. Each holds one mod's full file list,
  // so this is the shape of the runner's memory footprint.
  const peakLiveContexts = async (modCount: number): Promise<number> => {
    const probe = makeConcurrencyProbe();

    const hc = makeModHealthCheck({
      checkMod: async () => {
        await tick();
        probe.leave();
        return makeHealthCheckResult();
      },
    });

    await runPerModCheck(hc, fakeApi, {
      enumerate: () => entries(modCount),
      buildContext: async (entry) => {
        await tick();
        probe.enter();
        return makeModCheckContext({ modId: entry.modId });
      },
    });

    return probe.peak();
  };

  test("walks a bounded number of mods at a time", async () => {
    expect(await peakLiveContexts(400)).toBeLessThanOrEqual(CONCURRENCY_CEILING);
  });

  test("stops walking once the run is aborted", async () => {
    const abort = new AbortController();
    let walked = 0;

    const result = await runPerModCheck(makeModHealthCheck(), fakeApi, {
      signal: abort.signal,
      enumerate: () => entries(400),
      buildContext: async (entry) => {
        walked += 1;
        // Abort once the pool is saturated, where the registry's timeout would land.
        if (walked === MOD_WALK_CONCURRENCY) {
          abort.abort();
        }
        await tick();
        return makeModCheckContext({ modId: entry.modId });
      },
    });

    // How many tasks are in flight when the abort lands is p-queue's to decide; the bound is
    // what matters.
    expect(walked).toBeLessThanOrEqual(MOD_WALK_CONCURRENCY);
    // A partial walk must not read as a clean bill of health for the whole library.
    expect(result.message).toMatch(/stopped after \d+ of 400 mods/);
  });

  test("peak does not grow with the size of the library", async () => {
    const small = await peakLiveContexts(200);
    const large = await peakLiveContexts(800);
    expect(large).toBe(small);
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
