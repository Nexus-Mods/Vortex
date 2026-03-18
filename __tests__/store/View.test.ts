import { View } from "../../src/main/store/View";

interface TestRow {
  id: string;
  name: string;
  value: number;
}

function createMockConnection(rows: TestRow[] = []) {
  const runAndReadAll = jest.fn().mockResolvedValue({
    getRowObjectsJson: () => rows,
  });
  return { runAndReadAll } as any;
}

describe("View", () => {
  describe("all()", () => {
    it("returns all rows from the table", async () => {
      const rows = [
        { id: "1", name: "a", value: 10 },
        { id: "2", name: "b", value: 20 },
      ];
      const conn = createMockConnection(rows);
      const view = new View<TestRow>(conn, "test_table");

      const result = await view.all();

      expect(result).toEqual(rows);
      expect(conn.runAndReadAll).toHaveBeenCalledWith(
        "SELECT * FROM test_table"
      );
    });

    it("returns empty array for empty table", async () => {
      const conn = createMockConnection([]);
      const view = new View<TestRow>(conn, "test_table");

      const result = await view.all();

      expect(result).toEqual([]);
    });
  });

  describe("where()", () => {
    it("filters by a single column", async () => {
      const rows = [{ id: "1", name: "a", value: 10 }];
      const conn = createMockConnection(rows);
      const view = new View<TestRow>(conn, "test_table");

      const result = await view.where({ name: "a" });

      expect(result).toEqual(rows);
      expect(conn.runAndReadAll).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE "name" = $1',
        ["a"]
      );
    });

    it("filters by multiple columns with AND", async () => {
      const conn = createMockConnection([]);
      const view = new View<TestRow>(conn, "test_table");

      await view.where({ name: "a", value: 10 });

      expect(conn.runAndReadAll).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE "name" = $1 AND "value" = $2',
        ["a", 10]
      );
    });

    it("returns all rows when no filter keys provided", async () => {
      const conn = createMockConnection([
        { id: "1", name: "a", value: 10 },
      ]);
      const view = new View<TestRow>(conn, "test_table");

      await view.where({});

      expect(conn.runAndReadAll).toHaveBeenCalledWith(
        "SELECT * FROM test_table"
      );
    });
  });

  describe("findOne()", () => {
    it("returns first matching row", async () => {
      const row = { id: "1", name: "a", value: 10 };
      const conn = createMockConnection([row]);
      const view = new View<TestRow>(conn, "test_table");

      const result = await view.findOne({ id: "1" });

      expect(result).toEqual(row);
      expect(conn.runAndReadAll).toHaveBeenCalledWith(
        'SELECT * FROM test_table WHERE "id" = $1 LIMIT 1',
        ["1"]
      );
    });

    it("returns null when no match", async () => {
      const conn = createMockConnection([]);
      const view = new View<TestRow>(conn, "test_table");

      const result = await view.findOne({ id: "missing" });

      expect(result).toBeNull();
    });
  });

  describe("iteration", () => {
    it("supports for...of via Symbol.asyncIterator", async () => {
      const rows = [
        { id: "1", name: "a", value: 10 },
        { id: "2", name: "b", value: 20 },
      ];
      const conn = createMockConnection(rows);
      const view = new View<TestRow>(conn, "test_table");

      const collected: TestRow[] = [];
      for await (const row of view) {
        collected.push(row);
      }

      expect(collected).toEqual(rows);
    });
  });
});
