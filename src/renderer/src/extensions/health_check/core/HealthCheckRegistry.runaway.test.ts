import { afterEach, describe, expect, vi } from "vitest";

import { makeHealthCheckResult } from "../../../test-utils/builders";
import { test } from "../../../test-utils/healthCheckTest";
import * as perModRunner from "./perModRunner";

// Budget for a parked body to notice its abort and return. Sized for a loaded CI box, not the
// ~10ms it normally takes: a stuck body burns the budget once instead of failing at random.
const SETTLE = { timeout: 10000, interval: 10 };

/** What the registry does with a check whose body outlives the run's timeout (GH#23776). */
describe("HealthCheckRegistry timeout handling", () => {
  test("stops the check body once the run has timed out", async ({ makeHealthCheck }) => {
    const harness = makeHealthCheck();
    const parked = harness.parkCheck({ id: "slow-check", timeout: 50 });

    const result = await harness.run(parked.id);
    expect(result?.status).toBe("error");
    expect(result?.message).toMatch(/timed out/);

    // Nothing but the abort ends this body before teardown, so settling proves it was delivered.
    await vi.waitFor(() => expect(parked.hasSettled()).toBe(true), SETTLE);
    expect(parked.ticks()).toBeGreaterThan(0);
  });

  test("holds the concurrency guard until the abandoned body settles", async ({
    makeHealthCheck,
  }) => {
    const harness = makeHealthCheck();
    const parked = harness.parkCheck({ id: "slow-check", timeout: 50, respectAbort: false });

    await harness.run(parked.id);
    expect(parked.starts()).toBe(1);

    // The first body is still in flight, so a re-trigger must be refused.
    await harness.run(parked.id);
    expect(parked.starts()).toBe(1);
  });

  test("keeps refusing re-triggers for as long as the body runs", async ({ makeHealthCheck }) => {
    const harness = makeHealthCheck();
    const parked = harness.parkCheck({ id: "slow-check", timeout: 50, respectAbort: false });

    for (let i = 0; i < 4; i += 1) {
      await harness.run(parked.id);
    }

    expect(parked.starts()).toBe(1);
  });

  test("runs again once the abandoned body has finished", async ({ makeHealthCheck }) => {
    const harness = makeHealthCheck();
    const parked = harness.parkCheck({ id: "slow-check", timeout: 50 });

    await harness.run(parked.id);
    expect(parked.starts()).toBe(1);

    // Holding the slot for the body's lifetime must not wedge the check shut.
    await vi.waitFor(() => expect(parked.hasSettled()).toBe(true), SETTLE);
    await harness.run(parked.id);
    expect(parked.starts()).toBe(2);
  });
});

/** Which game's mods a per-mod check is allowed to reach (GH#23776). */
describe("HealthCheckRegistry game gating", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const stubRunner = () =>
    vi
      .spyOn(perModRunner, "runPerModCheck")
      .mockResolvedValue(makeHealthCheckResult({ checkId: "stub" }));

  test("skips a per-mod check registered for another game", async ({ makeHealthCheck }) => {
    const runner = stubRunner();
    const harness = makeHealthCheck({ gameId: "skyrimse" });
    const id = harness.registerModCheck({ id: "xrebirth-mod-has-files", gameId: "xrebirth" });

    await harness.run(id);

    expect(runner).not.toHaveBeenCalled();
  });

  test("runs a per-mod check registered for the active game", async ({ makeHealthCheck }) => {
    const runner = stubRunner();
    const harness = makeHealthCheck({ gameId: "xrebirth" });
    const id = harness.registerModCheck({ id: "xrebirth-mod-has-files", gameId: "xrebirth" });

    await harness.run(id);

    expect(runner).toHaveBeenCalledOnce();
  });

  test("drops a stored result once its game is no longer active", async ({ makeHealthCheck }) => {
    stubRunner();
    const harness = makeHealthCheck({ gameId: "xrebirth" });
    const id = harness.registerModCheck({ id: "xrebirth-mod-has-files", gameId: "xrebirth" });

    await harness.run(id);
    expect(harness.resultFor(id)).toBeDefined();

    harness.setState((draft) => {
      draft.persistent.profiles["profile-1"].gameId = "skyrimse";
    });
    await harness.run(id);

    // An xrebirth result has no meaning on the Skyrim health check page.
    expect(harness.resultFor(id)).toBeUndefined();
  });

  test("drops the result of a run whose game went away mid-flight", async ({ makeHealthCheck }) => {
    const harness = makeHealthCheck({ gameId: "xrebirth" });
    const id = harness.registerModCheck({ id: "xrebirth-mod-has-files", gameId: "xrebirth" });

    // The switch lands while the check is running, so the gate at the top of the run cannot
    // catch it; only the check made before the result is stored.
    vi.spyOn(perModRunner, "runPerModCheck").mockImplementation(async () => {
      harness.setState((draft) => {
        draft.persistent.profiles["profile-1"].gameId = "skyrimse";
      });
      return makeHealthCheckResult({ checkId: id });
    });

    expect(await harness.run(id)).toBeUndefined();
    expect(harness.resultFor(id)).toBeUndefined();
  });

  test("runs a per-mod check that claims no game", async ({ makeHealthCheck }) => {
    const runner = stubRunner();
    const harness = makeHealthCheck({ gameId: "skyrimse" });
    const id = harness.registerModCheck({ id: "generic-mod-check" });

    await harness.run(id);

    expect(runner).toHaveBeenCalledOnce();
  });
});
