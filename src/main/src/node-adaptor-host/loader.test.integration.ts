import { uri } from "@vortex/adaptor-api";
import * as path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

import type { IAdaptorHost, ILoadedAdaptor } from "./loader.js";

import { createAdaptorHost } from "./loader.js";

const BUNDLE_PATH = path.resolve(
  import.meta.dirname,
  "../../../../packages/adaptors/ping-test/dist/index.mjs",
);
const BOOTSTRAP_PATH = path.resolve(
  import.meta.dirname,
  "../../out/bootstrap.mjs",
);

describe("adaptor host integration (Worker)", () => {
  let host: IAdaptorHost;
  let loaded: ILoadedAdaptor;

  beforeAll(async () => {
    host = createAdaptorHost(
      {
        "vortex:host/ping": (msg) => {
          const payload = msg.payload as { method: string; args: unknown[] };
          if (payload.method === "ping")
            return Promise.resolve(`pong: ${JSON.stringify(payload.args[0])}`);
          return Promise.resolve({ status: "ok" });
        },
      },
      BOOTSTRAP_PATH,
    );

    loaded = await host.loadAdaptor({
      name: "ping-test",
      version: "1.0.0",
      bundlePath: BUNDLE_PATH,
      requires: ["vortex:host/ping"],
    });
  });

  it("loads an adaptor in a Worker and reads its manifest", () => {
    expect(loaded.manifest.name).toBe("ping-test");
    expect(loaded.manifest.version).toBe("1.0.0");
    expect(loaded.manifest.provides).toContainEqual(
      uri("vortex:adaptor/ping-test/echo"),
    );
  });

  it("dispatches method calls to the Worker", async () => {
    const result = await loaded.call("vortex:adaptor/ping-test/echo", "echo", [
      "hello",
    ]);
    expect(result).toBe('echo: pong: "hello"');
  });

  it("registers adaptor in name service and registry", () => {
    const resolved = host.nameService.resolve(
      uri("vortex:adaptor/ping-test/echo"),
    );
    expect(resolved).toBeDefined();

    const entries = host.registry.list();
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.some((e) => e.manifest.name === "ping-test")).toBe(true);
  });

  afterAll(async () => {
    await host?.shutdownAll();
  });
});

describe("adaptor host per-worker service factories", () => {
  it("mints a fresh session per worker and disposes it on shutdown", async () => {
    const events: string[] = [];
    let sessionCount = 0;

    const host = createAdaptorHost(
      {
        "vortex:host/ping": {
          perWorker() {
            const id = ++sessionCount;
            events.push(`create:${id}`);
            return {
              handler: (msg) => {
                const payload = msg.payload as {
                  method: string;
                  args: unknown[];
                };
                if (payload.method === "ping") {
                  return Promise.resolve(
                    `pong-${id}: ${JSON.stringify(payload.args[0])}`,
                  );
                }
                return Promise.resolve({ status: "ok" });
              },
              dispose: () => {
                events.push(`dispose:${id}`);
                return Promise.resolve();
              },
            };
          },
        },
      },
      BOOTSTRAP_PATH,
    );

    const a = await host.loadAdaptor({
      name: "ping-test",
      version: "1.0.0",
      bundlePath: BUNDLE_PATH,
      requires: ["vortex:host/ping"],
    });
    const b = await host.loadAdaptor({
      name: "ping-test",
      version: "1.0.0",
      bundlePath: BUNDLE_PATH,
      requires: ["vortex:host/ping"],
    });

    // Each worker must see its own session id in the echoed pong.
    const aReply = (await a.call("vortex:adaptor/ping-test/echo", "echo", [
      "hi",
    ])) as string;
    const bReply = (await b.call("vortex:adaptor/ping-test/echo", "echo", [
      "hi",
    ])) as string;
    expect(aReply).toBe('echo: pong-1: "hi"');
    expect(bReply).toBe('echo: pong-2: "hi"');

    // Orderly shutdown of one worker releases that worker's session only.
    await host.shutdown(a.pid);
    expect(events).toContain("create:1");
    expect(events).toContain("create:2");
    expect(events).toContain("dispose:1");
    expect(events).not.toContain("dispose:2");

    await host.shutdownAll();
    expect(events).toContain("dispose:2");
  });
});
