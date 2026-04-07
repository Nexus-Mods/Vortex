import * as path from "node:path";
import { describe, expect, it, afterAll } from "vitest";
import { createTestHarness, type ITestHarness } from "./harness.js";

const BUNDLE_PATH = path.resolve(
  import.meta.dirname,
  "../../../adaptors/ping-test/dist/index.cjs",
);
const BOOTSTRAP_PATH = path.resolve(
  import.meta.dirname,
  "../../dist/bootstrap.mjs",
);

describe("TestHarness (Worker isolation)", () => {
  let harness: ITestHarness;

  it("loads an adaptor in a Worker and returns the manifest", async () => {
    harness = await createTestHarness(
      BUNDLE_PATH,
      {
        "vortex:host/ping": async (msg) => {
          const payload = msg.payload as { method: string; args: unknown[] };
          if (payload.method === "ping") return `pong: ${payload.args[0]}`;
          return { status: "ok" };
        },
      },
      BOOTSTRAP_PATH,
    );

    expect(harness.manifest.provides).toHaveLength(1);
    expect(harness.manifest.provides[0]).toBe(
      "vortex:adaptor/ping-test/echo",
    );
  });

  it("dispatches calls through the Worker", async () => {
    const result = await harness.call(
      "vortex:adaptor/ping-test/echo",
      "echo",
      ["hello"],
    );
    expect(result).toBe("echo: pong: hello");
  });

  afterAll(async () => {
    await harness?.shutdown();
  });
});
