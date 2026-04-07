import * as path from "node:path";
import { describe, expect, it, afterAll } from "vitest";
import { createTestHarness, type ITestHarness } from "@vortex/adaptor-host/testing/harness";

const BUNDLE_PATH = path.resolve(import.meta.dirname, "../dist/index.cjs");
const BOOTSTRAP_PATH = path.resolve(
  import.meta.dirname,
  "../../../adaptor-host/dist/bootstrap.mjs",
);

describe("EchoService (Worker isolation)", () => {
  let harness: ITestHarness;

  it("loads in a Worker", async () => {
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
  });

  it("echoes data through the ping service", async () => {
    const result = await harness.call(
      "vortex:adaptor/ping-test/echo",
      "echo",
      ["hello"],
    );
    expect(result).toBe("echo: pong: hello");
  });

  it("handles empty data", async () => {
    const result = await harness.call(
      "vortex:adaptor/ping-test/echo",
      "echo",
      [""],
    );
    expect(result).toBe("echo: pong: ");
  });

  afterAll(async () => {
    await harness?.shutdown();
  });
});
