import { describe, it, expect, vi, beforeEach } from "vitest";

import { GenericDebouncer } from "./Debouncer";

// --- helpers ----------------------------------------------------------------

type Timeout = ReturnType<typeof setTimeout>;

function makeTimers() {
  vi.useFakeTimers();
  return {
    setFn: setTimeout,
    clearFn: clearTimeout,
    advance: (ms: number) => vi.advanceTimersByTimeAsync(ms),
    runAll: () => vi.runAllTimersAsync(),
  };
}

function makeDebouncer(
  func: (...args: any[]) => Error | PromiseLike<void>,
  debounceMS = 200,
  reset = true,
  triggerImmediately = false,
) {
  const { setFn, clearFn, advance, runAll } = makeTimers();
  const d = new GenericDebouncer<Timeout, typeof setTimeout, typeof clearTimeout>(
    setFn,
    clearFn,
    func,
    debounceMS,
    reset,
    triggerImmediately,
  );
  return { d, advance, runAll };
}

// --- tests ------------------------------------------------------------------

describe("GenericDebouncer", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  // ── basic scheduling ──────────────────────────────────────────────────────

  describe("basic scheduling", () => {
    it("does not call the function before the timer expires", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn);

      d.schedule();
      await advance(100);

      expect(fn).not.toHaveBeenCalled();
    });

    it("calls the function after the debounce delay", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn);

      d.schedule();
      await advance(200);

      expect(fn).toHaveBeenCalledOnce();
    });

    it("passes the latest args to the function", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn);

      d.schedule(undefined, "first");
      d.schedule(undefined, "second");
      await advance(200);

      expect(fn).toHaveBeenCalledWith("second");
    });

    it("invokes the callback with null on success", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn);
      const cb = vi.fn();

      d.schedule(cb);
      await advance(200);

      expect(cb).toHaveBeenCalledWith(null);
    });

    it("invokes the callback with an error on rejection", async () => {
      const err = new Error("boom");
      const fn = vi.fn().mockRejectedValue(err);
      const { d, advance } = makeDebouncer(fn);
      const cb = vi.fn();

      d.schedule(cb);
      await advance(200);

      expect(cb).toHaveBeenCalledWith(err);
    });

    it("propagates a synchronously thrown error to the callback", async () => {
      const err = new Error("sync boom");
      const fn = vi.fn(() => {
        throw err;
      });
      const { d, advance } = makeDebouncer(fn);
      const cb = vi.fn();

      d.schedule(cb);
      await advance(200);

      expect(cb).toHaveBeenCalledWith(err);
    });
  });

  // ── reset behaviour ───────────────────────────────────────────────────────

  describe("reset behaviour", () => {
    it("resets the timer on each schedule() call when reset=true", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn, 200, true);

      d.schedule();
      await advance(150);
      d.schedule(); // resets
      await advance(150); // only 150 ms since last schedule
      expect(fn).not.toHaveBeenCalled();

      await advance(50); // now 200 ms since last schedule
      expect(fn).toHaveBeenCalledOnce();
    });

    it("does NOT reset the timer when reset=false", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn, 200, false);

      d.schedule();
      await advance(150);
      d.schedule(); // should NOT reset
      await advance(50); // 200 ms total since first schedule

      expect(fn).toHaveBeenCalledOnce();
    });
  });

  // ── triggerImmediately ────────────────────────────────────────────────────

  describe("triggerImmediately=true", () => {
    it("calls the function immediately on first schedule()", () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d } = makeDebouncer(fn, 200, true, true);

      d.schedule();

      expect(fn).toHaveBeenCalledOnce();
    });

    it("does not call the function again before the cooldown expires", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn, 200, true, true);

      d.schedule();
      await advance(100);
      d.schedule();
      await advance(0); // flush microtasks

      expect(fn).toHaveBeenCalledOnce();
    });

    it("re-triggers after the cooldown when called again during cooldown", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn, 200, true, true);

      d.schedule(); // fires immediately, starts 200ms cooldown timer
      await advance(100);
      d.schedule(); // sets mRetrigger=true, resets cooldown to a fresh 200ms
      await advance(200); // full 200ms since reset → cooldown timer fires → re-triggers

      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("does NOT re-trigger if not called again during cooldown", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn, 200, true, true);

      d.schedule();
      await advance(300);

      expect(fn).toHaveBeenCalledOnce();
    });
  });

  // ── runNow ────────────────────────────────────────────────────────────────

  describe("runNow()", () => {
    it("calls the function immediately, skipping the timer", () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d } = makeDebouncer(fn, 200);

      d.schedule();
      d.runNow(vi.fn());

      expect(fn).toHaveBeenCalledOnce();
    });

    it("invokes callback on completion", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn, 200);
      const cb = vi.fn();

      d.runNow(cb);
      await advance(0); // flush microtasks

      expect(cb).toHaveBeenCalledWith(null);
    });

    it("schedules a re-run if called while already running", async () => {
      const resolvers: Array<() => void> = [];
      const fn = vi.fn(
        () =>
          new Promise<void>((r) => {
            resolvers.push(r);
          }),
      );
      const { d, advance } = makeDebouncer(fn, 200);
      const cb = vi.fn();

      d.runNow(vi.fn()); // starts first run, resolvers[0] pending
      d.runNow(cb); // queued as mReschedule="immediately", cb in mCallbacks

      expect(fn).toHaveBeenCalledOnce();

      expect(resolvers.length).toBeGreaterThanOrEqual(1);
      resolvers[0]!(); // resolve first run → finally → second run() starts, resolvers[1] pending
      await advance(0); // flush microtasks so second run() has been invoked
      expect(fn).toHaveBeenCalledTimes(2);

      expect(resolvers.length).toBeGreaterThanOrEqual(2);
      resolvers[1]!(); // resolve second run → invokeCallbacks → cb(null)
      await advance(0); // flush microtasks

      expect(cb).toHaveBeenCalledWith(null);
    });
  });

  // ── wait ──────────────────────────────────────────────────────────────────

  describe("wait()", () => {
    it("calls callback immediately when nothing is scheduled", () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d } = makeDebouncer(fn, 200);
      const cb = vi.fn();

      d.wait(cb);

      expect(cb).toHaveBeenCalledWith(null);
    });

    it("calls callback after the timer fires when something is scheduled", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn, 200);
      const waitCb = vi.fn();

      d.schedule();
      d.wait(waitCb);

      expect(waitCb).not.toHaveBeenCalled();

      await advance(200);

      expect(waitCb).toHaveBeenCalledWith(null);
    });

    it("runs the function immediately when immediately=true", () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d } = makeDebouncer(fn, 200);

      d.schedule();
      d.wait(vi.fn(), true);

      expect(fn).toHaveBeenCalledOnce();
    });

    it("does not reset the timer", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn, 200);

      d.schedule();
      await advance(100);
      d.wait(vi.fn()); // should not reset
      await advance(100);

      expect(fn).toHaveBeenCalledOnce();
    });
  });

  // ── clear ─────────────────────────────────────────────────────────────────

  describe("clear()", () => {
    it("cancels a pending timer so the function is never called", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, runAll } = makeDebouncer(fn, 200);

      d.schedule();
      d.clear();
      await runAll();

      expect(fn).not.toHaveBeenCalled();
    });
  });

  // ── rescheduling while running ─────────────────────────────────────────────

  describe("rescheduling while running", () => {
    it("re-runs after completion when schedule() is called during execution", async () => {
      let resolve!: () => void;
      const fn = vi.fn(
        () =>
          new Promise<void>((r) => {
            resolve = r;
          }),
      );
      const { d, advance } = makeDebouncer(fn, 200);

      d.schedule();
      await advance(200); // starts first run
      d.schedule(); // queued

      expect(fn).toHaveBeenCalledOnce();

      resolve();
      await advance(200); // flush finally + reschedule timer

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // ── multiple callbacks ─────────────────────────────────────────────────────

  describe("multiple callbacks", () => {
    it("invokes all registered callbacks on completion", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const { d, advance } = makeDebouncer(fn, 200);
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();

      d.schedule(cb1);
      d.schedule(cb2);
      d.wait(cb3);
      await advance(200);

      expect(cb1).toHaveBeenCalledWith(null);
      expect(cb2).toHaveBeenCalledWith(null);
      expect(cb3).toHaveBeenCalledWith(null);
    });
  });
});
