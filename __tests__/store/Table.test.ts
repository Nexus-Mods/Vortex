import { Table } from "../../src/main/store/Table";

interface TestRow {
  id: string;
  name: string;
  value: number;
}

function createMockConnection(rows: TestRow[] = []) {
  return {
    runAndReadAll: jest.fn().mockResolvedValue({
      getRowObjectsJson: () => rows,
    }),
    run: jest.fn().mockResolvedValue(undefined),
  } as any;
}

describe("Table", () => {
  describe("inherits View", () => {
    it("has all(), where(), findOne()", async () => {
      const rows = [{ id: "1", name: "a", value: 10 }];
      const conn = createMockConnection(rows);
      const table = new Table<TestRow>(conn, "test_table");

      expect(await table.all()).toEqual(rows);
      expect(await table.where({ id: "1" })).toEqual(rows);
      expect(await table.findOne({ id: "1" })).toEqual(rows[0]);
    });
  });

  describe("insert()", () => {
    it("inserts a single row", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await table.insert({ id: "1", name: "a", value: 10 });

      expect(conn.run).toHaveBeenCalledWith(
        "INSERT INTO test_table (id, name, value) VALUES ($1, $2, $3)",
        ["1", "a", 10]
      );
    });
  });

  describe("insertMany()", () => {
    it("inserts multiple rows", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await table.insertMany([
        { id: "1", name: "a", value: 10 },
        { id: "2", name: "b", value: 20 },
      ]);

      expect(conn.run).toHaveBeenCalledTimes(2);
    });
  });

  describe("update()", () => {
    it("updates matching rows", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await table.update({ id: "1" }, { name: "updated" });

      expect(conn.run).toHaveBeenCalledWith(
        "UPDATE test_table SET name = $1 WHERE id = $2",
        ["updated", "1"]
      );
    });

    it("is a no-op when set is empty", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await table.update({ id: "1" }, {});

      expect(conn.run).not.toHaveBeenCalled();
    });
  });

  describe("delete()", () => {
    it("deletes matching rows", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await table.delete({ id: "1" });

      expect(conn.run).toHaveBeenCalledWith(
        "DELETE FROM test_table WHERE id = $1",
        ["1"]
      );
    });

    it("throws on empty filter to prevent full-table delete", async () => {
      const conn = createMockConnection();
      const table = new Table<TestRow>(conn, "test_table");

      await expect(table.delete({})).rejects.toThrow(
        "delete() requires at least one filter"
      );
      expect(conn.run).not.toHaveBeenCalled();
    });
  });
});
