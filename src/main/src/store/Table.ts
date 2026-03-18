import { View } from "./View";

export class Table<T extends Record<string, unknown>> extends View<T> {
  async insert(row: T): Promise<void> {
    const keys = Object.keys(row);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const values = Object.values(row);
    const sql = `INSERT INTO ${this._tableName} (${keys.join(", ")}) VALUES (${placeholders.join(", ")})`;
    await this._connection.run(sql, values);
  }

  async insertMany(rows: T[]): Promise<void> {
    for (const row of rows) {
      await this.insert(row);
    }
  }

  async update(where: Partial<T>, set: Partial<T>): Promise<void> {
    const setEntries = Object.entries(set);
    if (setEntries.length === 0) {
      return;
    }

    const whereEntries = Object.entries(where);
    let paramIndex = 1;

    const setClauses = setEntries.map(
      ([key]) => `${key} = $${paramIndex++}`
    );
    const whereClauses = whereEntries.map(
      ([key]) => `${key} = $${paramIndex++}`
    );
    const values = [
      ...setEntries.map(([, v]) => v),
      ...whereEntries.map(([, v]) => v),
    ];

    let sql = `UPDATE ${this._tableName} SET ${setClauses.join(", ")}`;
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(" AND ")}`;
    }
    await this._connection.run(sql, values);
  }

  async delete(where: Partial<T>): Promise<void> {
    const entries = Object.entries(where);
    if (entries.length === 0) {
      throw new Error("delete() requires at least one filter");
    }

    const clauses = entries.map(
      (_, i) => `${entries[i][0]} = $${i + 1}`
    );
    const values = entries.map(([, v]) => v);
    const sql = `DELETE FROM ${this._tableName} WHERE ${clauses.join(" AND ")}`;
    await this._connection.run(sql, values);
  }
}
