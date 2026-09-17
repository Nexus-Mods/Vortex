import { VortexError } from "@vortex/shared/errors";
import { describe, expect, test, vi } from "vitest";

import { makeApiHarness } from "../../../test-utils/builders";
import { LootErrorReporter, LootPhase } from "./LootErrorReporter";
import { toLootError } from "./lootErrors";

describe("LootErrorReporter", () => {
  const harness = () => {
    const record = vi.fn();
    return { ...makeApiHarness(), record, reporter: new LootErrorReporter(record) };
  };

  /** A failure node-loot raised about the pipe itself, named as it names it. */
  const worker = (name: string, fields: Record<string, string | number> = {}) =>
    toLootError(Object.assign(new Error("the worker gave up"), { name, ...fields }));

  const died = () => worker("RemoteDied", { call: "sortPlugins" });

  test("reports the call a dead worker was answering", () => {
    const { api, record, reporter } = harness();

    reporter.report(api, died(), LootPhase.Sort);

    expect(record).toHaveBeenCalledWith(expect.any(String), expect.any(VortexError), {
      "loot.kind": "loot:process-died",
      "loot.call": "sortPlugins",
      "loot.phase": "sort",
      "loot.recovering": false,
    });
  });

  test("reports the code a broken pipe ended on", () => {
    const { api, record, reporter } = harness();

    reporter.report(
      api,
      worker("RemoteDied", { call: "getUserGroups", code: "ECONNRESET" }),
      LootPhase.Metadata,
    );

    expect(record).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(VortexError),
      expect.objectContaining({ "loot.call": "getUserGroups", "loot.error_code": "ECONNRESET" }),
    );
  });

  test("reports the frame size an unreadable answer came in", () => {
    const { api, record, reporter } = harness();

    reporter.report(
      api,
      worker("InvalidResponse", { call: "getUserGroups", frameBytes: 512 }),
      LootPhase.Metadata,
    );

    expect(record).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(VortexError),
      expect.objectContaining({ "loot.call": "getUserGroups", "loot.frame_bytes": 512 }),
    );
  });

  // a plugin the user broke is not a fault of the pipe, and says nothing about why IPC fails
  test("says nothing about a failure inside libloot", () => {
    const { api, record, reporter } = harness();

    reporter.report(
      api,
      toLootError(new Error('The group "early" does not exist')),
      LootPhase.Sort,
    );

    expect(record).not.toHaveBeenCalled();
  });

  // a worker that stays broken fails every refresh that follows it
  test("reports a failure that keeps happening once", () => {
    const { api, record, reporter } = harness();

    reporter.report(api, died(), LootPhase.Sort);
    reporter.report(api, died(), LootPhase.Sort);

    expect(record).toHaveBeenCalledTimes(1);
  });

  // the same failure says something different about sorting than about reading plugin details
  test("reports a failure once for each phase it breaks", () => {
    const { api, record, reporter } = harness();

    reporter.report(api, died(), LootPhase.Sort);
    reporter.report(api, died(), LootPhase.Metadata);

    expect(record).toHaveBeenCalledTimes(2);
  });

  test("reports it again once the phase it broke has worked", () => {
    const { api, record, reporter } = harness();

    reporter.report(api, died(), LootPhase.Sort);
    reporter.succeeded(LootPhase.Sort);
    reporter.report(api, died(), LootPhase.Sort);

    expect(record).toHaveBeenCalledTimes(2);
  });

  // a phase that stays broken while another works is still one failure, not one per refresh
  test("keeps a phase suppressed while a different phase works", () => {
    const { api, record, reporter } = harness();

    reporter.report(api, died(), LootPhase.Metadata);
    reporter.succeeded(LootPhase.LoadPlugins);
    reporter.report(api, died(), LootPhase.Metadata);

    expect(record).toHaveBeenCalledTimes(1);
  });

  test("reports a failure again once a new worker is up", () => {
    const { api, record, reporter } = harness();

    reporter.report(api, died(), LootPhase.Metadata);
    reporter.succeeded();
    reporter.report(api, died(), LootPhase.Metadata);

    expect(record).toHaveBeenCalledTimes(2);
  });

  // the fallback kind names no call, so without its message every unknown cause shares one key
  test("reports unrecognised failures with different causes separately", () => {
    const { api, record, reporter } = harness();

    reporter.report(api, toLootError(new Error("access violation")), LootPhase.Sort);
    reporter.report(api, toLootError(new Error("out of memory")), LootPhase.Sort);

    expect(record).toHaveBeenCalledTimes(2);
  });

  test("tells the user a sort was abandoned, in LOOT's words", () => {
    const { api, notifications, reporter } = harness();

    reporter.report(
      api,
      toLootError(new Error('The group "early" does not exist')),
      LootPhase.Sort,
    );

    expect(notifications).toEqual([
      {
        id: "loot-failed",
        type: "warning",
        message: 'Plugins not sorted because: the group "early" does not exist',
      },
    ]);
  });

  // explainMasterNotLoaded knows which master is missing and why, which the kind alone does not
  test("tells the user the reason a caller worked out", () => {
    const { api, notifications, reporter } = harness();
    const failure = { severity: "warning" as const, message: "Skyrim.esm is not deployed" };

    reporter.report(api, toLootError(new Error("plugin not loaded")), LootPhase.Sort, { failure });

    expect(notifications[0].message).toBe("Plugins not sorted because: Skyrim.esm is not deployed");
  });

  test("tells the user which plugins LOOT could not read", () => {
    const { api, errorNotifications, reporter } = harness();

    reporter.report(
      api,
      toLootError(new Error('"Bad.esp" is not a valid plugin')),
      LootPhase.LoadPlugins,
    );

    expect(errorNotifications).toEqual([
      {
        title: "Failed to parse plugins",
        message: "LOOT could not parse Bad.esp",
        allowReport: false,
      },
    ]);
  });

  // a worker Vortex restarts by itself leaves the user nothing to do
  test("says nothing to the user about a failure it recovers from", () => {
    const { api, errorNotifications, notifications, record, reporter } = harness();

    reporter.report(api, died(), LootPhase.Worker, { recovering: true });

    expect(record).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(VortexError),
      expect.objectContaining({ "loot.recovering": true }),
    );
    expect(errorNotifications).toEqual([]);
    expect(notifications).toEqual([]);
  });

  // the raw error is a stack trace from another process, which says nothing to the user
  test("tells the user the worker stopped without showing them the crash", () => {
    const { api, errorNotifications, reporter } = harness();

    reporter.report(api, died(), LootPhase.Worker);

    expect(errorNotifications).toEqual([
      { title: "LOOT process died", message: "LOOT stopped unexpectedly", allowReport: false },
    ]);
  });
});
