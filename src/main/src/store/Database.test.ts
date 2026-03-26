import { describe, it, expect, vi } from "vitest";

import type LevelPersist from "./LevelPersist";
import type QueryInvalidator from "./QueryInvalidator";

import { Database } from "./Database";
import { Table } from "./Table";
import { View } from "./View";

type ModRow = {
  mod_id: string;
  name: string;
};

function createMockConnection() {
  return {
    run: vi.fn().mockResolvedValue(undefined),
    runAndReadAll: vi.fn().mockResolvedValue({
      getRowObjectsJson: () => [],
    }),
  };
}

function createMockLevelPersist() {
  return {
    connection: createMockConnection(),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    getDirtyTables: vi.fn().mockResolvedValue([]),
  };
}

function createMockInvalidator() {
  return {
    notifyDirtyTables: vi.fn(),
  } as unknown as QueryInvalidator;
}

describe("Database", () => {
  describe("createTable / createView", () => {
    it("creates Table instances", () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist as unknown as LevelPersist, null);

      const table = db.createTable("mods_pivot");
      expect(table).toBeInstanceOf(Table);
    });

    it("creates View instances", () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist as unknown as LevelPersist, null);

      const view = db.createView("profiles_view");
      expect(view).toBeInstanceOf(View);
    });
  });

  describe("query()", () => {
    it("executes raw SQL and returns typed results", async () => {
      const rows = [{ mod_id: "1", name: "test" }];
      const persist = createMockLevelPersist();
      persist.connection.runAndReadAll.mockResolvedValue({
        getRowObjectsJson: () => rows,
      });
      const db = new Database(persist as unknown as LevelPersist, null);

      const result = await db.query<ModRow>("SELECT * FROM mods_pivot");

      expect(result).toEqual(rows);
    });
  });

  describe("transaction()", () => {
    it("commits on success", async () => {
      const persist = createMockLevelPersist();
      const invalidator = createMockInvalidator();
      const db = new Database(persist as unknown as LevelPersist, invalidator);

      await db.transaction(async (tx) => {
        const mods = tx.createTable<ModRow>("mods_pivot");
        await mods.insert({ mod_id: "1", name: "test" });
      });

      expect(persist.beginTransaction).toHaveBeenCalledTimes(1);
      expect(persist.commitTransaction).toHaveBeenCalledTimes(1);
      expect(persist.rollbackTransaction).not.toHaveBeenCalled();
    });

    it("rolls back on error", async () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist as unknown as LevelPersist, null);

      await expect(
        db.transaction(() => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");

      expect(persist.beginTransaction).toHaveBeenCalledTimes(1);
      expect(persist.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(persist.commitTransaction).not.toHaveBeenCalled();
    });

    it("notifies invalidator with dirty tables on commit", async () => {
      const dirty = [{ database: "db", table: "mods_pivot", type: "write" }];
      const persist = createMockLevelPersist();
      persist.getDirtyTables.mockResolvedValue(dirty);
      const invalidator = createMockInvalidator();
      const db = new Database(persist as unknown as LevelPersist, invalidator);

      await db.transaction(async () => {});

      expect(persist.getDirtyTables).toHaveBeenCalled();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(invalidator.notifyDirtyTables).toHaveBeenCalledWith(dirty);
    });

    it("does not notify invalidator when no invalidator set", async () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist as unknown as LevelPersist, null);

      await db.transaction(async () => {});

      expect(persist.commitTransaction).toHaveBeenCalled();
    });
  });
});
