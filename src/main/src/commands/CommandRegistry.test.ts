import { describe, expect, it, vi } from "vitest";

import { CommandRegistry } from "./CommandRegistry";

describe("CommandRegistry", () => {
  it("awaits async handlers before resolving", async () => {
    const registry = new CommandRegistry();
    let resolveHandler: (() => void) | undefined;
    const handler = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveHandler = resolve;
        }),
    );
    registry.register("discovery.start", handler);

    let resolved = false;
    const execution = registry.execute("discovery.start", {
      force: true,
    });
    void execution.then(() => {
      resolved = true;
    });

    await Promise.resolve();

    expect(handler).toHaveBeenCalledWith({ force: true });
    expect(resolved).toBe(false);

    resolveHandler?.();
    await expect(execution).resolves.toBeUndefined();
    expect(resolved).toBe(true);
  });

  it("rejects unknown commands", async () => {
    const registry = new CommandRegistry();

    await expect(registry.execute("missing.command")).rejects.toThrow(
      "Unknown command: 'missing.command'",
    );
  });

  it("rejects handlers that return data", async () => {
    const registry = new CommandRegistry();
    registry.register(
      "discovery.start",
      (() => Promise.resolve("unexpected")) as unknown as () => Promise<void>,
    );

    await expect(registry.execute("discovery.start")).rejects.toThrow(
      "must not return data",
    );
  });
});
