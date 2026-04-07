import type { IMethodMessage } from "@vortex/adaptor-api/interfaces";
import { describe, expect, it } from "vitest";

import {
  createMessageIdAllocator,
  createPidAllocator,
  createServiceProxy,
} from "./runtime.js";

// --- Allocators ---

describe("createPidAllocator", () => {
  it("generates unique PIDs per allocator", () => {
    const nextPid = createPidAllocator();
    const a = nextPid();
    const b = nextPid();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^pid:/);
  });

  it("independent allocators have independent counters", () => {
    const alloc1 = createPidAllocator();
    const alloc2 = createPidAllocator();
    expect(alloc1()).toBe(alloc2());
  });
});

describe("createMessageIdAllocator", () => {
  it("generates unique message IDs", () => {
    const nextId = createMessageIdAllocator();
    const a = nextId();
    const b = nextId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^msg:/);
  });
});

// --- createServiceProxy ---

describe("createServiceProxy", () => {
  it("is not thenable (can be safely awaited without dispatching)", () => {
    const send = (msg: IMethodMessage) => Promise.resolve(msg.args);
    const proxy = createServiceProxy<{ foo(): Promise<string> }>(
      "test:svc",
      send,
    );
    expect((proxy as Record<string, unknown>)["then"]).toBeUndefined();
  });

  it("dispatches method calls through send", async () => {
    const received: IMethodMessage[] = [];
    const send = (msg: IMethodMessage) => {
      received.push(msg);
      return Promise.resolve("result");
    };
    const proxy = createServiceProxy<{ foo(x: string): Promise<string> }>(
      "test:svc",
      send,
    );
    const result = await proxy.foo("bar");
    expect(result).toBe("result");
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      uri: "test:svc",
      method: "foo",
      args: ["bar"],
    });
  });
});
