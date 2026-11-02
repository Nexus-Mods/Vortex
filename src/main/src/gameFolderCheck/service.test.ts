import { VortexGameId } from "@vortex/shared";
import type { GameFolderCheckInput } from "@vortex/shared/ipc";
import { describe, expect, it } from "vitest";

import type { IRunOutput } from "./run";
import { GameFolderCheckService } from "./service";

const input = (gameId: string) => ({ gameId: VortexGameId(gameId) }) as GameFolderCheckInput;
const output = (gameId: string) =>
  ({ result: { input: input(gameId) }, files: [] }) as unknown as IRunOutput;

/** A run that finishes when told to, and rejects when its signal aborts. */
function controllableRun() {
  const pending = new Map<string, () => void>();
  const started: string[] = [];
  const run = (job: GameFolderCheckInput, signal: AbortSignal) =>
    new Promise<IRunOutput>((resolve, reject) => {
      started.push(job.gameId);
      signal.addEventListener("abort", () => reject(new Error("aborted")));
      pending.set(job.gameId, () => resolve(output(job.gameId)));
    });
  const finish = (gameId: string) => pending.get(gameId)?.();
  return { run, finish, started };
}

describe("GameFolderCheckService", () => {
  it("runs one check at a time", async () => {
    const { run, finish, started } = controllableRun();
    const service = new GameFolderCheckService(run);
    const first = service.schedule(input("a"));
    const second = service.schedule(input("b"));
    await Promise.resolve();
    expect(started).toEqual(["a"]);

    finish("a");
    await expect(first).resolves.toMatchObject({ result: { input: { gameId: "a" } } });
    expect(started).toEqual(["a", "b"]);
    finish("b");
    await second;
  });

  it("resolves undefined for a cancelled running check", async () => {
    const { run } = controllableRun();
    const service = new GameFolderCheckService(run);
    const check = service.schedule(input("a"));
    await Promise.resolve();
    service.cancel(VortexGameId("a"));
    await expect(check).resolves.toBeUndefined();
  });

  it("drops a cancelled queued check without running it", async () => {
    const { run, finish, started } = controllableRun();
    const service = new GameFolderCheckService(run);
    const first = service.schedule(input("a"));
    const second = service.schedule(input("b"));
    service.cancel(VortexGameId("b"));
    await expect(second).resolves.toBeUndefined();
    finish("a");
    await first;
    expect(started).toEqual(["a"]);
  });

  it("joins a running check for the same game instead of running another", async () => {
    const { run, finish, started } = controllableRun();
    const service = new GameFolderCheckService(run);
    const first = service.schedule(input("a"));
    await Promise.resolve();
    const again = service.schedule(input("a"));
    expect(again).toBe(first);

    finish("a");
    await expect(again).resolves.toMatchObject({ result: { input: { gameId: "a" } } });
    expect(started).toEqual(["a"]);
  });

  it("joins a queued check for the same game", async () => {
    const { run, finish, started } = controllableRun();
    const service = new GameFolderCheckService(run);
    const first = service.schedule(input("a"));
    const queued = service.schedule(input("b"));
    expect(service.schedule(input("b"))).toBe(queued);

    finish("a");
    await first;
    await Promise.resolve();
    finish("b");
    await queued;
    expect(started).toEqual(["a", "b"]);
  });

  it("runs a game again once its earlier check finished", async () => {
    const { run, finish, started } = controllableRun();
    const service = new GameFolderCheckService(run);
    const first = service.schedule(input("a"));
    await Promise.resolve();
    finish("a");
    await first;
    const second = service.schedule(input("a"));
    expect(second).not.toBe(first);
    await Promise.resolve();
    finish("a");
    await second;
    expect(started).toEqual(["a", "a"]);
  });

  it("passes a failed check on", async () => {
    const service = new GameFolderCheckService(() => Promise.reject(new Error("disk gone")));
    await expect(service.schedule(input("a"))).rejects.toThrow("disk gone");
  });
});
