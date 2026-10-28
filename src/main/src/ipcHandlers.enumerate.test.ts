import { ChaosFS, InMemoryFSBuilder, QualifiedPath } from "@vortex/shared/filesystem";
import { describe, expect, it, vi } from "vitest";

const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

// init registers every handler; only the enumeration ones run here
vi.mock("./ipc", () => ({
  betterIpcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn),
    on: vi.fn(),
  },
}));
vi.mock("electron", () => ({ app: {}, ipcMain: { on: vi.fn() } }));
vi.mock("./getVortexPath", () => ({ getVortexPath: vi.fn(() => "/vortex") }));

import { init } from "./ipcHandlers";

const handler = (channel: string) => {
  const fn = handlers.get(channel);
  if (fn === undefined) throw new Error(`no handler registered for ${channel}`);
  return fn;
};

describe("fs:enumerate-next", () => {
  it("ends the enumeration session when the listing fails", async () => {
    const folder = QualifiedPath.fromNative("/game/Data");
    const builder = new InMemoryFSBuilder();
    builder.file(folder.join("a.esp"), { type: "text", data: "a" });
    builder.file(folder.join("b.esp"), { type: "text", data: "b" });
    init(
      new ChaosFS(builder.build(), [
        { op: "enumerateDirectory", fault: { kind: "fs:not-found" }, failAfter: 1 },
      ]),
    );
    const sender = { once: vi.fn(), removeListener: vi.fn() };
    const handle = await handler("fs:enumerate-open")({ sender }, folder.toWire(), {});

    await expect(handler("fs:enumerate-next")({ sender }, handle, 10)).rejects.toThrow();

    await expect(handler("fs:enumerate-next")({ sender }, handle, 10)).rejects.toThrow(
      `No enumeration session for handle ${String(handle)}`,
    );
  });
});
