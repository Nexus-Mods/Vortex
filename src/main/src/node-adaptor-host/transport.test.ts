import type { IMethodMessage } from "@vortex/adaptor-api";

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
