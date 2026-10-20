import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import init from "./index";

type SuppressFn = (tests: string[], cb: () => PromiseLike<void>) => Promise<void>;

// the checks are queued on a timer and then run through a promise chain, so give the chain a turn
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

// the runner keeps its checks in module state, so every test registers its own probe
function startTestRunner() {
  let onceCallback: () => void = () => undefined;
  const stateHandlers: Record<string, () => void> = {};
  const registerAPI = vi.fn();
  const context: any = {
    registerAPI,
    once: (cb: () => void) => {
      onceCallback = cb;
    },
    api: {
      events: { on: vi.fn() },
      onStateChange: (statePath: string[], cb: () => void) => {
        stateHandlers[statePath.join(".")] = cb;
      },
      dismissNotification: vi.fn(),
    },
  };
  init(context);
  onceCallback();

  const check = vi.fn(() => undefined);
  context.registerTest("probe", "settings-changed", check);

  const withSuppressedTests: SuppressFn = registerAPI.mock.calls.find(
    ([name]) => name === "withSuppressedTests",
  )[1];

  return {
    check,
    withSuppressedTests,
    changeSettings: () => stateHandlers.settings(),
  };
}

describe("test runner", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs a settings-changed check once the delay has passed", async () => {
    const { check, changeSettings } = startTestRunner();

    changeSettings();
    vi.advanceTimersByTime(500);
    await flush();

    expect(check).toHaveBeenCalledTimes(1);
  });

  it("holds a check that was queued before a suppression started until it lifts", async () => {
    const { check, changeSettings, withSuppressedTests } = startTestRunner();

    // the settings change that queues the check also starts the work the suppression covers
    changeSettings();
    let finishSetup: () => void = () => undefined;
    const suppressed = withSuppressedTests(
      ["settings-changed"],
      () =>
        new Promise<void>((resolve) => {
          finishSetup = resolve;
        }),
    );

    vi.advanceTimersByTime(500);
    await flush();
    expect(check).not.toHaveBeenCalled();

    finishSetup();
    await suppressed;
    vi.advanceTimersByTime(500);
    await flush();

    expect(check).toHaveBeenCalledTimes(1);
  });
});
