import type { DuckDBConnection } from "@duckdb/node-api";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../logging", () => ({ log: vi.fn() }));

import { log } from "../logging";

import LevelPersist from "./LevelPersist";

const SEPARATOR = "###";

function createMockConnection() {
  return {
    run: vi.fn().mockResolvedValue(undefined),
    runAndReadAll: vi.fn().mockResolvedValue({ getRows: () => [] }),
  };
}

function createPersist() {
  const connection = createMockConnection();
  const persist = new LevelPersist(
    connection as unknown as DuckDBConnection,
    "db",
  );
  return { persist, connection };
}

describe("LevelPersist.setItem", () => {
  it("issues a single INSERT (no SELECT-then-branch)", async () => {
    const { persist, connection } = createPersist();

    await persist.setItem(["settings", "window", "x"], "42");

    expect(connection.runAndReadAll).not.toHaveBeenCalled();
    expect(connection.run).toHaveBeenCalledTimes(1);
    expect(connection.run).toHaveBeenCalledWith(
      "INSERT INTO db.kv VALUES ($1, $2)",
      [`settings${SEPARATOR}window${SEPARATOR}x`, "42"],
    );
  });

  it("does not begin or commit a transaction internally", async () => {
    const { persist, connection } = createPersist();

    await persist.setItem(["a"], "v");

    const sqls = connection.run.mock.calls.map((c) => c[0] as string);
    expect(sqls).not.toContainEqual(expect.stringMatching(/BEGIN/i));
    expect(sqls).not.toContainEqual(expect.stringMatching(/COMMIT/i));
  });

  it("propagates connection errors", async () => {
    const { persist, connection } = createPersist();
    connection.run.mockRejectedValueOnce(new Error("disk full"));

    await expect(persist.setItem(["a"], "v")).rejects.toThrow("disk full");
  });
});

describe("LevelPersist.removeItem", () => {
  it("issues a single DELETE", async () => {
    const { persist, connection } = createPersist();

    await persist.removeItem(["settings", "window", "x"]);

    expect(connection.run).toHaveBeenCalledTimes(1);
    expect(connection.run).toHaveBeenCalledWith(
      "DELETE FROM db.kv WHERE key = $1",
      [`settings${SEPARATOR}window${SEPARATOR}x`],
    );
  });
});

describe("LevelPersist.bulkSetItem", () => {
  it("is a no-op for an empty list", async () => {
    const { persist, connection } = createPersist();

    await persist.bulkSetItem([]);

    expect(connection.run).not.toHaveBeenCalled();
  });

  it("emits a single multi-row INSERT with positional params", async () => {
    const { persist, connection } = createPersist();

    await persist.bulkSetItem([
      { key: ["a"], value: "1" },
      { key: ["b"], value: "2" },
      { key: ["c"], value: "3" },
    ]);

    expect(connection.run).toHaveBeenCalledTimes(1);
    const [sql, params] = connection.run.mock.calls[0];
    expect(sql).toBe(
      "INSERT INTO db.kv VALUES ($1, $2), ($3, $4), ($5, $6)",
    );
    expect(params).toEqual(["a", "1", "b", "2", "c", "3"]);
  });

  it("joins compound key paths with the separator", async () => {
    const { persist, connection } = createPersist();

    await persist.bulkSetItem([
      { key: ["settings", "window", "x"], value: "42" },
    ]);

    const params = connection.run.mock.calls[0][1] as string[];
    expect(params[0]).toBe(`settings${SEPARATOR}window${SEPARATOR}x`);
  });

  it("scales placeholder count linearly with item count", async () => {
    const { persist, connection } = createPersist();

    const items = Array.from({ length: 100 }, (_, i) => ({
      key: [`k${i}`],
      value: `v${i}`,
    }));
    await persist.bulkSetItem(items);

    const sql = connection.run.mock.calls[0][0] as string;
    const placeholders = sql.match(/\$\d+/g) ?? [];
    expect(placeholders.length).toBe(200); // 2 per item

    const params = connection.run.mock.calls[0][1] as string[];
    expect(params.length).toBe(200);
    expect(params[0]).toBe("k0");
    expect(params[1]).toBe("v0");
    expect(params[198]).toBe("k99");
    expect(params[199]).toBe("v99");
  });
});

describe("LevelPersist.bulkRemoveItem", () => {
  it("is a no-op for an empty list", async () => {
    const { persist, connection } = createPersist();

    await persist.bulkRemoveItem([]);

    expect(connection.run).not.toHaveBeenCalled();
  });

  it("emits a single DELETE … WHERE key IN (…)", async () => {
    const { persist, connection } = createPersist();

    await persist.bulkRemoveItem([["a"], ["b"], ["c"]]);

    expect(connection.run).toHaveBeenCalledTimes(1);
    const [sql, params] = connection.run.mock.calls[0];
    expect(sql).toBe("DELETE FROM db.kv WHERE key IN ($1, $2, $3)");
    expect(params).toEqual(["a", "b", "c"]);
  });

  it("joins compound key paths with the separator", async () => {
    const { persist, connection } = createPersist();

    await persist.bulkRemoveItem([["settings", "window"]]);

    const params = connection.run.mock.calls[0][1] as string[];
    expect(params).toEqual([`settings${SEPARATOR}window`]);
  });
});

describe("LevelPersist transaction state", () => {
  it("inTransaction is false before BEGIN", () => {
    const { persist } = createPersist();
    expect(persist.inTransaction).toBe(false);
  });

  it("inTransaction becomes true after a successful BEGIN", async () => {
    const { persist } = createPersist();

    await persist.beginTransaction();

    expect(persist.inTransaction).toBe(true);
  });

  it("inTransaction stays false if BEGIN throws", async () => {
    const { persist, connection } = createPersist();
    connection.run.mockRejectedValueOnce(new Error("already in transaction"));

    await expect(persist.beginTransaction()).rejects.toThrow();

    expect(persist.inTransaction).toBe(false);
  });

  it("inTransaction is cleared after a successful COMMIT", async () => {
    const { persist } = createPersist();
    await persist.beginTransaction();

    await persist.commitTransaction();

    expect(persist.inTransaction).toBe(false);
  });

  it("inTransaction is cleared even if COMMIT throws", async () => {
    const { persist, connection } = createPersist();
    await persist.beginTransaction();
    connection.run.mockRejectedValueOnce(new Error("commit failed"));

    await expect(persist.commitTransaction()).rejects.toThrow("commit failed");

    expect(persist.inTransaction).toBe(false);
  });

  it("inTransaction is cleared even if ROLLBACK throws", async () => {
    const { persist, connection } = createPersist();
    await persist.beginTransaction();
    connection.run.mockRejectedValueOnce(new Error("nothing to roll back"));

    await expect(persist.rollbackTransaction()).rejects.toThrow();

    expect(persist.inTransaction).toBe(false);
  });
});

describe("LevelPersist write timing breadcrumbs", () => {
  const logMock = log as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logMock.mockClear();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // Returns a Date.now spy primed to advance by `elapsedMs` between the
  // first and second call, so a single timed write computes that elapsed.
  function fakeElapsed(elapsedMs: number) {
    const spy = vi.spyOn(Date, "now");
    let call = 0;
    spy.mockImplementation(() => (call++ === 0 ? 1_000 : 1_000 + elapsedMs));
    return spy;
  }

  it("does not log when a write completes under the slow threshold", async () => {
    const { persist } = createPersist();
    fakeElapsed(50);

    await persist.setItem(["a"], "v");

    expect(logMock).not.toHaveBeenCalled();
  });

  it("logs a warning when a write exceeds SLOW_WRITE_THRESHOLD_MS", async () => {
    const { persist } = createPersist();
    fakeElapsed(300);

    await persist.setItem(["settings", "window", "x"], "42");

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(
      "warn",
      "level_pivot slow Write",
      expect.objectContaining({
        method: "setItem",
        alias: "db",
        count: 1,
        elapsedMs: 300,
      }),
    );
  });

  it("does not warn for an exactly-on-threshold write (strict greater-than)", async () => {
    const { persist } = createPersist();
    fakeElapsed(250);

    await persist.setItem(["a"], "v");

    expect(logMock).not.toHaveBeenCalled();
  });

  it("propagates the rejection but still emits the warning when a slow write fails", async () => {
    const { persist, connection } = createPersist();
    connection.run.mockRejectedValueOnce(new Error("disk error"));
    fakeElapsed(400);

    await expect(persist.setItem(["a"], "v")).rejects.toThrow("disk error");

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(
      "warn",
      "level_pivot slow Write",
      expect.objectContaining({ method: "setItem", elapsedMs: 400 }),
    );
  });

  it("reports the row count from bulkSetItem", async () => {
    const { persist } = createPersist();
    fakeElapsed(500);

    const items = Array.from({ length: 100 }, (_, i) => ({
      key: [`k${i}`],
      value: `v${i}`,
    }));
    await persist.bulkSetItem(items);

    expect(logMock).toHaveBeenCalledWith(
      "warn",
      "level_pivot slow Write",
      expect.objectContaining({
        method: "bulkSetItem",
        count: 100,
        elapsedMs: 500,
      }),
    );
  });

  it("reports the key count from bulkRemoveItem", async () => {
    const { persist } = createPersist();
    fakeElapsed(500);

    const keys = Array.from({ length: 7 }, (_, i) => [`k${i}`]);
    await persist.bulkRemoveItem(keys);

    expect(logMock).toHaveBeenCalledWith(
      "warn",
      "level_pivot slow Write",
      expect.objectContaining({
        method: "bulkRemoveItem",
        count: 7,
        elapsedMs: 500,
      }),
    );
  });

  it("does not log for an empty bulk call (no Write actually issued)", async () => {
    const { persist } = createPersist();
    fakeElapsed(10_000);

    await persist.bulkSetItem([]);
    await persist.bulkRemoveItem([]);

    expect(logMock).not.toHaveBeenCalled();
  });

  describe("trace mode (VORTEX_TRACE_DB_WRITES=1)", () => {
    beforeEach(() => {
      vi.stubEnv("VORTEX_TRACE_DB_WRITES", "1");
    });

    it("emits enter and exit at debug level even when fast", async () => {
      const { persist } = createPersist();
      fakeElapsed(5);

      await persist.setItem(["a"], "v");

      expect(logMock).toHaveBeenCalledTimes(2);
      expect(logMock).toHaveBeenNthCalledWith(
        1,
        "debug",
        "level_pivot Write enter",
        expect.objectContaining({ method: "setItem", alias: "db", count: 1 }),
      );
      expect(logMock).toHaveBeenNthCalledWith(
        2,
        "debug",
        "level_pivot Write exit",
        expect.objectContaining({
          method: "setItem",
          alias: "db",
          count: 1,
          elapsedMs: 5,
        }),
      );
    });

    it("does not double-log: trace mode suppresses the warn path", async () => {
      const { persist } = createPersist();
      fakeElapsed(500);

      await persist.setItem(["a"], "v");

      expect(logMock).toHaveBeenCalledTimes(2);
      const levels = logMock.mock.calls.map((c): unknown => c[0]);
      expect(levels).toEqual(["debug", "debug"]);
      expect(levels).not.toContain("warn");
    });

    it("still emits the exit line on rejection", async () => {
      const { persist, connection } = createPersist();
      connection.run.mockRejectedValueOnce(new Error("io fail"));
      fakeElapsed(400);

      await expect(persist.setItem(["a"], "v")).rejects.toThrow("io fail");

      expect(logMock).toHaveBeenCalledTimes(2);
      expect(logMock).toHaveBeenNthCalledWith(
        2,
        "debug",
        "level_pivot Write exit",
        expect.objectContaining({ elapsedMs: 400 }),
      );
    });

    it("ignores any value other than the literal '1'", async () => {
      vi.stubEnv("VORTEX_TRACE_DB_WRITES", "true");
      const { persist } = createPersist();
      fakeElapsed(5);

      await persist.setItem(["a"], "v");

      // Fast write + trace not enabled -> no logging at all.
      expect(logMock).not.toHaveBeenCalled();
    });
  });
});
