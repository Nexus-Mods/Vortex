import { Database } from "../../src/main/store/Database";
import { View } from "../../src/main/store/View";
import { Table } from "../../src/main/store/Table";

interface ModRow {
  mod_id: string;
  name: string;
}

function createMockConnection() {
  return {
    run: jest.fn().mockResolvedValue(undefined),
    runAndReadAll: jest.fn().mockResolvedValue({
      getRowObjectsJson: () => [],
    }),
  } as any;
}

function createMockLevelPersist() {
  return {
    connection: createMockConnection(),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    getDirtyTables: jest.fn().mockResolvedValue([]),
  } as any;
}

function createMockInvalidator() {
  return {
    notifyDirtyTables: jest.fn(),
  } as any;
}

describe("Database", () => {
  describe("createTable / createView", () => {
    it("creates Table instances", () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist, null);

      const table = db.createTable("mods_pivot");
      expect(table).toBeInstanceOf(Table);
    });

    it("creates View instances", () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist, null);

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
      const db = new Database(persist, null);

      const result = await db.query<ModRow>("SELECT * FROM mods_pivot");

      expect(result).toEqual(rows);
    });
  });

  describe("transaction()", () => {
    it("commits on success", async () => {
      const persist = createMockLevelPersist();
      const invalidator = createMockInvalidator();
      const db = new Database(persist, invalidator);

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
      const db = new Database(persist, null);

      await expect(
        db.transaction(async () => {
          throw new Error("boom");
        })
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
      const db = new Database(persist, invalidator);

      await db.transaction(async () => {});

      expect(persist.getDirtyTables).toHaveBeenCalled();
      expect(invalidator.notifyDirtyTables).toHaveBeenCalledWith(dirty);
    });

    it("does not notify invalidator when no invalidator set", async () => {
      const persist = createMockLevelPersist();
      const db = new Database(persist, null);

      await db.transaction(async () => {});

      expect(persist.commitTransaction).toHaveBeenCalled();
    });
  });

});
