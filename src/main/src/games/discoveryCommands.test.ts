import { describe, expect, it, vi } from "vitest";

import { CommandRegistry } from "../commands/CommandRegistry";
import { setupDiscoveryCommands } from "./discoveryCommands";

describe("setupDiscoveryCommands", () => {
  it("registers discovery.start as an async command", async () => {
    const registry = new CommandRegistry();
    let resolveRun: (() => void) | undefined;
    const coordinator = {
      runDiscovery: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveRun = resolve;
          }),
      ),
    };

    setupDiscoveryCommands(
      registry,
      coordinator as unknown as Parameters<typeof setupDiscoveryCommands>[1],
    );

    let resolved = false;
    const execution = registry.execute("discovery.start");
    void execution.then(() => {
      resolved = true;
    });

    await Promise.resolve();

    expect(coordinator.runDiscovery).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(false);

    resolveRun?.();
    await expect(execution).resolves.toBeUndefined();
    expect(resolved).toBe(true);
  });
});
