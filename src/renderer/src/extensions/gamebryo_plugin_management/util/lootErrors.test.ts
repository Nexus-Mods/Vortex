import { VortexError } from "@vortex/shared/errors";
import { describe, expect, test } from "vitest";

import { makeApiHarness } from "../../../test-utils/builders";
import { EdgeType, type ICycleEdge } from "../types/ILoot";
import { describeLootError, toLootError } from "./lootErrors";

describe("toLootError", () => {
  test("classifies a cyclic interaction with the cycle it carries", () => {
    const cycle: ICycleEdge[] = [{ name: "A.esp", typeOfEdgeToNextVertex: EdgeType.userLoadAfter }];
    const raw = Object.assign(
      new Error('Cyclic interaction detected between "A.esp" and "B.esp"'),
      {
        cycle,
      },
    );

    const err = toLootError(raw);

    expect(err).toBeInstanceOf(VortexError);
    expect(err.data).toEqual({ kind: "loot:cyclic-interaction", cycle });
    expect(err.message).toBe(raw.message);
    expect(err.cause).toBe(raw);
  });

  test("classifies a plugin libloot had not loaded by its structured plugin field", () => {
    const raw = Object.assign(new Error("plugin not loaded"), {
      name: "PluginNotLoaded",
      plugin: "A.esp",
    });

    expect(toLootError(raw).data).toEqual({ kind: "loot:invalid-plugin", plugins: ["A.esp"] });
  });

  test("classifies invalid plugins named in the message", () => {
    const raw = new Error('"Bad.esp" is not a valid plugin');

    expect(toLootError(raw).data).toEqual({ kind: "loot:invalid-plugin", plugins: ["Bad.esp"] });
  });

  test("classifies a master libloot could not load from a failed load", () => {
    const raw = Object.assign(new Error('The plugin "M.esm" has not been loaded'), {
      func: "loadPlugins",
    });

    expect(toLootError(raw).data).toEqual({ kind: "loot:master-not-loaded", master: "M.esm" });
  });

  test("classifies a missing group with the group name", () => {
    const raw = new Error('The group "gone-group" does not exist.');

    expect(toLootError(raw).data).toEqual({ kind: "loot:missing-group", group: "gone-group" });
  });

  test("classifies a failed version condition with the executable it checked", () => {
    const raw = new Error(
      'Failed to evaluate condition "version("SkyrimSE.exe", "1.5.97.0", >=)": bad version',
    );

    expect(toLootError(raw).data).toEqual({
      kind: "loot:condition-failed",
      executable: "SkyrimSE.exe",
    });
  });

  test("classifies a condition failure without a version check as one with no executable", () => {
    const raw = new Error('Failed to evaluate condition "file("x.esp")": no such file');

    expect(toLootError(raw).data).toEqual({ kind: "loot:condition-failed", executable: undefined });
  });

  test("classifies a call on a closed libloot instance as canceled by this side", () => {
    expect(toLootError(new Error("Already Closed")).data).toEqual({ kind: "process-canceled" });
  });

  test("classifies a dead worker process by its error name", () => {
    const raw = Object.assign(new Error("worker gone"), { name: "RemoteDied" });

    expect(toLootError(raw).data).toEqual({ kind: "loot:process-died" });
  });

  test("classifies a dead worker by the call it was answering", () => {
    const raw = Object.assign(new Error("LOOT process died"), {
      name: "RemoteDied",
      call: "sortPlugins",
    });

    expect(toLootError(raw).data).toEqual({ kind: "loot:process-died", call: "sortPlugins" });
  });

  test("classifies an unreadable answer with the call and the size of the frame", () => {
    const raw = Object.assign(new Error("Invalid response"), {
      name: "InvalidResponse",
      call: "getPluginMetadata",
      frameBytes: 4096,
    });

    expect(toLootError(raw).data).toEqual({
      kind: "loot:invalid-response",
      call: "getPluginMetadata",
      frameBytes: 4096,
    });
  });

  // the worker rejecting an argument means the call was built wrong here, not that libloot failed
  test("classifies a rejected argument as this side's mistake", () => {
    const err = toLootError(new Error("parameter 2 expected to be a string"));

    expect(err.data).toEqual({
      kind: "loot:api-misuse",
      detail: "parameter 2 expected to be a string",
    });
  });

  test("falls back to a generic libloot failure for anything else, keeping the message", () => {
    const err = toLootError(new Error("access violation"));

    expect(err.data).toEqual({ kind: "loot:failed" });
    expect(err.message).toBe("access violation");
  });

  test("wraps a non-error value as a generic libloot failure", () => {
    expect(toLootError("boom").data).toEqual({ kind: "loot:failed" });
  });
});

describe("describeLootError", () => {
  const describe_ = (raw: unknown) => {
    const harness = makeApiHarness();
    return describeLootError(harness.api.translate, toLootError(raw));
  };

  test("names the group that does not exist", () => {
    const failure = describe_(new Error('The group "Early Loaders" does not exist'));

    expect(failure.message).toBe('the group "Early Loaders" does not exist');
  });

  test("names the plugins LOOT could not parse", () => {
    const raw = Object.assign(new Error("plugin not loaded"), {
      name: "PluginNotLoaded",
      plugin: "A.esp",
    });

    expect(describe_(raw).message).toBe("LOOT could not parse A.esp");
  });

  test("says a condition could not be evaluated", () => {
    const raw = new Error(
      'Failed to evaluate condition "version("SkyrimSE.exe", "1.6", ==)": missing',
    );

    expect(describe_(raw).message).toBe("a masterlist condition could not be evaluated");
  });

  test("says the process stopped when the worker died", () => {
    const raw = Object.assign(new Error("worker gone"), { name: "RemoteDied" });

    expect(describe_(raw).message).toBe("LOOT stopped unexpectedly");
  });

  // libloot's own text is a stack trace or an internal detail as often as not, so it goes to the
  // log and the user gets something they can act on
  test("points an unrecognised failure at the log instead of repeating it", () => {
    const failure = describe_(new Error("access violation reading 0x0"));

    expect(failure.message).toBe("something went wrong in LOOT; the details are in the Vortex log");
    expect(failure.message).not.toContain("access violation");
  });

  test("names Vortex, not LOOT, when the worker rejected an argument", () => {
    const failure = describe_(new Error("parameter 2 expected to be a string"));

    expect(failure.message).toBe("Vortex asked LOOT for something it could not accept");
    expect(failure.message).not.toContain("parameter 2");
  });
});
