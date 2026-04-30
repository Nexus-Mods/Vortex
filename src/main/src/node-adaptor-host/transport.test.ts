import type { IMethodMessage } from "@nexusmods/adaptor-api";

import { MessageChannel } from "node:worker_threads";
import { describe, it, expect } from "vitest";

import { createRpcTransport } from "./transport.js";

function makeChannel() {
  const { port1, port2 } = new MessageChannel();
  const a = createRpcTransport(port1);
  const b = createRpcTransport(port2);
  return { a, b, port1, port2 };
}

describe("createRpcTransport", () => {
  it("sends a call and receives a result", async () => {
    const { a, b } = makeChannel();

    b.onCall((msg: IMethodMessage) => {
      return Promise.resolve(`echo:${msg.method}`);
    });

    const result = await a.call({ uri: "test:svc", method: "ping", args: [] });
    expect(result).toBe("echo:ping");

    a.dispose();
    b.dispose();
  });

  it("propagates errors from the remote side", async () => {
    const { a, b } = makeChannel();

    b.onCall(() => {
      return Promise.reject(new Error("remote failure"));
    });

    await expect(
      a.call({ uri: "test:svc", method: "fail", args: [] }),
    ).rejects.toThrow("remote failure");

    a.dispose();
    b.dispose();
  });

  it("handles concurrent calls with independent correlation", async () => {
    const { a, b } = makeChannel();

    b.onCall(async (msg: IMethodMessage) => {
      const delay = (msg.args[0] as number) ?? 0;
      await new Promise((r) => setTimeout(r, delay));
      return msg.args[0];
    });

    // Call with slow (50ms) and fast (0ms) — fast should resolve first
    const slow = a.call({ uri: "test:svc", method: "wait", args: [50] });
    const fast = a.call({ uri: "test:svc", method: "wait", args: [0] });

    const [slowResult, fastResult] = await Promise.all([slow, fast]);
    expect(slowResult).toBe(50);
    expect(fastResult).toBe(0);

    a.dispose();
    b.dispose();
  });

  it("supports bidirectional calls", async () => {
    const { a, b } = makeChannel();

    a.onCall((msg: IMethodMessage) => Promise.resolve(`from-a:${msg.method}`));
    b.onCall((msg: IMethodMessage) => Promise.resolve(`from-b:${msg.method}`));

    const [resultFromA, resultFromB] = await Promise.all([
      // b calls a
      b.call({ uri: "test:svc", method: "hello", args: [] }),
      // a calls b
      a.call({ uri: "test:svc", method: "world", args: [] }),
    ]);

    expect(resultFromA).toBe("from-a:hello");
    expect(resultFromB).toBe("from-b:world");

    a.dispose();
    b.dispose();
  });

  it("sends and receives one-way signals", async () => {
    const { a, b } = makeChannel();

    const received = b.once<{ greeting: string }>("init");
    a.send({ type: "init", greeting: "hello" });

    const signal = await received;
    expect(signal).toEqual({ type: "init", greeting: "hello" });

    a.dispose();
    b.dispose();
  });

  it("carries name/code/data through the structured error envelope", async () => {
    const { a, b } = makeChannel();

    class CustomError extends Error {
      readonly code: string;
      readonly isTransient: boolean;
      constructor(message: string, code: string, isTransient: boolean) {
        super(message);
        this.name = "CustomError";
        this.code = code;
        this.isTransient = isTransient;
      }
    }

    b.onCall(() => Promise.reject(new CustomError("boom", "not found", true)));

    await a.call({ uri: "test:svc", method: "fail", args: [] }).then(
      () => {
        throw new Error("expected rejection");
      },
      (err: unknown) => {
        expect(err).toBeInstanceOf(Error);
        const e = err as Error & { code?: string; isTransient?: boolean };
        expect(e.name).toBe("CustomError");
        expect(e.message).toBe("boom");
        expect(e.code).toBe("not found");
        expect(e.isTransient).toBe(true);
      },
    );

    a.dispose();
    b.dispose();
  });

  it("preserves Error.cause across the transport envelope", async () => {
    const { a, b } = makeChannel();

    b.onCall(() => {
      const root = new Error("root cause");
      root.name = "RootError";
      (root as Error & { code?: string }).code = "EROOT";
      const wrapped = new Error("wrapped", { cause: root });
      wrapped.name = "WrappedError";
      return Promise.reject(wrapped);
    });

    await a.call({ uri: "test:svc", method: "fail", args: [] }).then(
      () => {
        throw new Error("expected rejection");
      },
      (err: unknown) => {
        expect(err).toBeInstanceOf(Error);
        const top = err as Error;
        expect(top.name).toBe("WrappedError");
        expect(top.message).toBe("wrapped");

        expect(top.cause).toBeInstanceOf(Error);
        const cause = top.cause as Error & { code?: string };
        expect(cause.name).toBe("RootError");
        expect(cause.message).toBe("root cause");
        expect(cause.code).toBe("EROOT");
      },
    );

    a.dispose();
    b.dispose();
  });

  it("truncates cause chains deeper than the envelope limit", async () => {
    const { a, b } = makeChannel();

    b.onCall(() => {
      // Chain: L0 → L1 → L2 → L3 → L4. Envelope keeps the top + 3 causes, so
      // L4 is dropped.
      const l4 = new Error("l4");
      const l3 = new Error("l3", { cause: l4 });
      const l2 = new Error("l2", { cause: l3 });
      const l1 = new Error("l1", { cause: l2 });
      const l0 = new Error("l0", { cause: l1 });
      return Promise.reject(l0);
    });

    await a
      .call({ uri: "test:svc", method: "fail", args: [] })
      .catch((err: unknown) => {
        const chain: string[] = [];
        let cur: unknown = err;
        while (cur instanceof Error) {
          chain.push(cur.message);
          cur = (cur as Error & { cause?: unknown }).cause;
        }
        expect(chain).toEqual(["l0", "l1", "l2", "l3"]);
      });

    a.dispose();
    b.dispose();
  });

  it("falls back to a generic Error when no envelope metadata is present", async () => {
    const { a, b } = makeChannel();

    b.onCall(() => Promise.reject(new Error("plain")));

    await expect(
      a.call({ uri: "test:svc", method: "fail", args: [] }),
    ).rejects.toMatchObject({ name: "Error", message: "plain" });

    a.dispose();
    b.dispose();
  });

  it("rejects pending calls on dispose", async () => {
    const { a, b } = makeChannel();

    // Register a handler that never resolves
    b.onCall(() => new Promise(() => {}));

    const pending = a.call({ uri: "test:svc", method: "hang", args: [] });
    a.dispose();

    await expect(pending).rejects.toThrow("transport disposed");

    b.dispose();
  });
});
