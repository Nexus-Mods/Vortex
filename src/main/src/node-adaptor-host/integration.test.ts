import * as path from "node:path";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { uri } from "@vortex/adaptor-api/branded";
import type { IAdaptorHost, ILoadedAdaptor } from "./loader.js";
import { createAdaptorHost } from "./loader.js";

const BUNDLE_PATH = path.resolve(
  import.meta.dirname,
  "../../../../packages/adaptors/ping-test/dist/index.cjs",
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
    expect(result).toBe("echo: pong: hello");
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
