import * as core from "@actions/core";
import { ClickHouseClient, createClient } from "@clickhouse/client";

import { DbMode, FINGERPRINT_RE, FingerprintRow } from "./types";

const TABLE = "vortex.resolved_fingerprints";

const insertRows = async (client: ClickHouseClient, rows: FingerprintRow[]): Promise<void> => {
  const updatedAt = new Date().toISOString().replace("T", " ").substring(0, 19);
  const values = rows.map((r) => ({
    fingerprint: r.fingerprint,
    pr_url: r.pr_url ?? "",
    updated_at: updatedAt,
    updated_by: r.updated_by ?? "",
    release_version: r.release_version ?? "",
    status: r.status,
  }));

  await client.insert({
    table: TABLE,
    values,
    format: "JSONEachRow",
  });
};

const deleteRows = async (client: ClickHouseClient, rows: FingerprintRow[]): Promise<void> => {
  const fingerprints = [...new Set(rows.map((r) => r.fingerprint))];

  // Lightweight DELETE (ClickHouse 23.3+). Fingerprints are bound as
  // Array(String) parameters — no string interpolation in the query.
  await client.command({
    query: `DELETE FROM ${TABLE} WHERE fingerprint IN {fps: Array(String)}`,
    query_params: { fps: fingerprints },
  });
};

/**
 * Applies the collected rows to `vortex.resolved_fingerprints` in ClickHouse:
 * `insert` appends them with a fresh `updated_at` timestamp; `delete` removes
 * every row matching the listed fingerprints (lightweight DELETE, ClickHouse
 * 23.3+). Re-validates each fingerprint as defense-in-depth before issuing
 * the query.
 */
export const applyToClickHouse = async (dbMode: DbMode, rows: FingerprintRow[]): Promise<void> => {
  for (const r of rows) {
    if (!r.fingerprint || !FINGERPRINT_RE.test(r.fingerprint)) {
      throw new Error(`Invalid or missing fingerprint: ${JSON.stringify(r)}`);
    }
  }

  const url = core.getInput("clickhouse-url", { required: true });
  const username = core.getInput("clickhouse-user", { required: true });
  const password = core.getInput("clickhouse-password", { required: true });

  const client = createClient({ url, username, password });
  try {
    if (dbMode === "insert") {
      await insertRows(client, rows);
      core.info(`Inserted ${rows.length} fingerprint row(s).`);
    } else {
      await deleteRows(client, rows);
      core.info(`Deleted rows for ${rows.length} fingerprint(s).`);
    }
  } finally {
    await client.close();
  }
};
