import { describe, expect, it, vi } from "vitest";

import { QueryClient } from "./queryClient";

describe("QueryClient", () => {
  it("caches a successful query result and reuses it while fresh", async () => {
    const execute = vi.fn().mockResolvedValue([{ id: "1" }]);
    const onDirty: (listener: (queryNames: string[]) => void) => () => void =
      vi.fn().mockReturnValue(() => undefined);
    const client = new QueryClient({ execute, onDirty });

    await expect(client.ensureQueryData("all_store_games", {})).resolves.toEqual([
      { id: "1" },
    ]);
    await expect(client.ensureQueryData("all_store_games", {})).resolves.toEqual([
      { id: "1" },
    ]);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(onDirty).toHaveBeenCalledTimes(1);
  });

  it("marks cached entries stale on dirty and refreshes on next read", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([{ id: "1" }])
      .mockResolvedValueOnce([{ id: "2" }]);
    let dirtyListener: ((queryNames: string[]) => void) | undefined;
    const onDirty: (listener: (queryNames: string[]) => void) => () => void =
      vi.fn((listener: (queryNames: string[]) => void) => {
        dirtyListener = listener;
        return () => undefined;
      });
    const client = new QueryClient({
      execute,
      onDirty,
    });

    await client.ensureQueryData("all_store_games", {});
    dirtyListener?.(["all_store_games"]);

    await expect(client.ensureQueryData("all_store_games", {})).resolves.toEqual([
      { id: "2" },
    ]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("keeps last good data when a stale refresh fails", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([{ id: "1" }])
      .mockRejectedValueOnce(new Error("boom"));
    let dirtyListener: ((queryNames: string[]) => void) | undefined;
    const onDirty: (listener: (queryNames: string[]) => void) => () => void =
      vi.fn((listener: (queryNames: string[]) => void) => {
        dirtyListener = listener;
        return () => undefined;
      });
    const client = new QueryClient({
      execute,
      onDirty,
    });

    await client.ensureQueryData("all_store_games", {});
    dirtyListener?.(["all_store_games"]);

    await expect(client.ensureQueryData("all_store_games", {})).resolves.toEqual([
      { id: "1" },
    ]);
    expect(client.peekQueryData("all_store_games", {})).toEqual([{ id: "1" }]);
  });
});
