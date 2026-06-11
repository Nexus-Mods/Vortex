/**
 * Regression test for APP-461: `new Worker(...)` from `node:worker_threads`
 * crashes in the Electron renderer ("The V8 platform used by this instance
 * of Node does not support creating Workers"). The dispatcher in bsdiff.ts
 * must use the DOM Worker variant whenever a DOM `Worker` global exists, and
 * must never touch `node:worker_threads`.
 *
 * This test simulates a renderer environment by defining `globalThis.Worker`,
 * imports `bsdiff` fresh, kicks off a patch op, and asserts the dispatcher
 * constructed the DOM Worker (and that worker_threads was never required).
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";

describe("bsdiff renderer dispatch (regression for APP-461)", () => {
  let originalWorker: typeof globalThis.Worker | undefined;
  let workerSpy: Mock<(url: string) => void>;
  let workerThreadsTouched: boolean;

  beforeEach(() => {
    originalWorker = (globalThis as { Worker?: typeof Worker }).Worker;

    workerThreadsTouched = false;
    workerSpy = vi.fn<(url: string) => void>();
    const recordUrl = workerSpy;

    class MockWorker {
      private listeners = new Map<string, ((evt: { data: unknown }) => void)[]>();
      constructor(public url: string) {
        recordUrl(url);
      }
      postMessage(msg: { id?: number }): void {
        // Echo a fake successful response for op messages (those carry an id).
        // The init message (wasm bytes, no id) is ignored by the dispatcher.
        queueMicrotask(() => {
          for (const l of this.listeners.get("message") ?? []) {
            l({ data: { id: msg.id, result: new Uint8Array([0xbe, 0xef]) } });
          }
        });
      }
      addEventListener(type: string, listener: (evt: { data: unknown }) => void): void {
        const list = this.listeners.get(type) ?? [];
        list.push(listener);
        this.listeners.set(type, list);
      }
    }
    (globalThis as { Worker?: unknown }).Worker = MockWorker;

    // Tripwire: if anything in the bsdiff dispatcher ever falls back to
    // node:worker_threads in this environment, this flag flips and the test
    // fails. This is the actual regression we're guarding against.
    vi.doMock("worker_threads", () => {
      workerThreadsTouched = true;
      return {
        Worker: class {
          constructor() {
            workerThreadsTouched = true;
            throw new Error("regression: bsdiff used worker_threads when DOM Worker was available");
          }
        },
      };
    });

    vi.resetModules();
  });

  afterEach(() => {
    (globalThis as { Worker?: unknown }).Worker = originalWorker;
    vi.restoreAllMocks();
    vi.doUnmock("worker_threads");
  });

  it("constructs a DOM Worker (not node:worker_threads) when globalThis.Worker is defined", async () => {
    const bsdiff = await import("./bsdiff.js");

    const result = await bsdiff.createPatch(new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6]));

    expect(workerSpy).toHaveBeenCalledTimes(1);
    const calledUrl = workerSpy.mock.calls[0]?.[0];
    expect(calledUrl).toMatch(/^file:/);
    expect(calledUrl).toMatch(/bsdiffWorker\.dom/);
    expect(workerThreadsTouched).toBe(false);
    expect(result).toEqual(new Uint8Array([0xbe, 0xef]));
  });

  it("reuses the same DOM Worker across calls", async () => {
    const bsdiff = await import("./bsdiff.js");

    await bsdiff.createPatch(new Uint8Array([1]), new Uint8Array([2]));
    await bsdiff.applyPatch(new Uint8Array([1]), new Uint8Array([2]));

    expect(workerSpy).toHaveBeenCalledTimes(1);
  });
});
