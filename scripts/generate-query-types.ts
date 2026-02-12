/**
 * Build-time script to generate TypeScript types from SQL query definitions.
 *
 * Usage: ts-node scripts/generate-query-types.ts
 *
 * 1. Creates a temporary DuckDB instance + loads level_pivot
 * 2. ATTACHes a temp empty LevelDB (for schema-only operation)
 * 3. Runs all `setup` queries (pivot table definitions)
 * 4. Runs all `view` queries (creates views)
 * 5. For each `select` query: prepares the statement, reads column metadata
 * 6. Maps DuckDB types to TypeScript types
 * 7. Writes output to src/shared/types/generated/queryTypes.ts
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { DuckDBConnection, DuckDBInstance, DuckDBType } from "@duckdb/node-api";

// Import the parser from source
import { parseAllQueries } from "../src/main/store/queryParser";
import type { ParsedQuery, ParsedQueryParam } from "../src/main/store/queryParser";

const QUERIES_DIR = path.resolve(__dirname, "..", "src", "queries");
const OUTPUT_FILE = path.resolve(
  __dirname,
  "..",
  "src",
  "shared",
  "types",
  "generated",
  "queryTypes.ts",
);

/** Map DuckDB type string to TypeScript type */
function duckdbTypeToTS(duckdbType: string): string {
  const normalized = duckdbType.toUpperCase();
  switch (normalized) {
    case "VARCHAR":
    case "TEXT":
    case "STRING":
    case "UUID":
      return "string";
    case "INTEGER":
    case "INT":
    case "INT4":
    case "SMALLINT":
    case "INT2":
    case "TINYINT":
    case "INT1":
    case "FLOAT":
    case "FLOAT4":
    case "REAL":
    case "DOUBLE":
    case "FLOAT8":
    case "DECIMAL":
    case "NUMERIC":
    case "UINTEGER":
    case "USMALLINT":
    case "UTINYINT":
      return "number";
    case "BIGINT":
    case "INT8":
    case "HUGEINT":
    case "UBIGINT":
    case "UHUGEINT":
      return "bigint";
    case "BOOLEAN":
    case "BOOL":
      return "boolean";
    case "DATE":
    case "TIME":
    case "TIMESTAMP":
    case "TIMESTAMP WITH TIME ZONE":
    case "TIMESTAMPTZ":
      return "string";
    case "BLOB":
      return "Uint8Array";
    default:
      // For complex or unknown types, fall back to string
      return "string";
  }
}

/** Convert DuckDBType object to TypeScript type string */
function duckdbTypeObjToTS(typeObj: DuckDBType): string {
  // DuckDBType has a toString() or alias property
  const typeStr = String(typeObj);
  return duckdbTypeToTS(typeStr);
}

/** Convert snake_case query name to PascalCase */
function toPascalCase(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

async function main(): Promise<void> {
  console.log("Parsing SQL query files...");
  const queries = parseAllQueries(QUERIES_DIR);

  const setupQueries = queries.filter((q) => q.type === "setup");
  const viewQueries = queries.filter((q) => q.type === "view");
  const selectQueries = queries.filter((q) => q.type === "select");

  console.log(
    `Found ${setupQueries.length} setup, ${viewQueries.length} view, ${selectQueries.length} select queries`,
  );

  // Create temporary DuckDB instance for schema introspection
  const { DuckDBInstance: DuckDBInstanceCtor } = require("@duckdb/node-api");
  const instance: DuckDBInstance = await DuckDBInstanceCtor.create(":memory:", {
    allow_unsigned_extensions: "true",
  });
  const connection: DuckDBConnection = await instance.connect();

  try {
    // Install and load level_pivot
    console.log("Installing level_pivot...");
    await connection.run(
      "INSTALL level_pivot FROM 'https://halgari.github.io/duckdb-level-pivot/current_release'",
    );
    await connection.run("LOAD level_pivot");

    // Create a temp LevelDB for schema-only operation
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-gen-"));
    const tmpDbPath = path.join(tmpDir, "gen.db");
    await connection.run(
      `ATTACH '${tmpDbPath.replace(/'/g, "''")}' AS db (TYPE level_pivot, CREATE_IF_MISSING true)`,
    );
    await connection.run(
      "CALL level_pivot_create_table('db', 'kv', NULL, ['key', 'value'], table_mode := 'raw')",
    );

    // Run setup queries
    for (const q of setupQueries) {
      console.log(`  Running setup: ${q.name}`);
      await connection.run(q.sql);
    }

    // Run view queries
    for (const q of viewQueries) {
      console.log(`  Running view: ${q.name}`);
      await connection.run(q.sql);
    }

    // Introspect select queries
    interface QueryTypeInfo {
      query: ParsedQuery;
      columns: Array<{ name: string; tsType: string }>;
    }

    const typeInfos: QueryTypeInfo[] = [];

    for (const q of selectQueries) {
      console.log(`  Inspecting select: ${q.name}`);
      const prepared = await connection.prepare(q.sql);
      const columns: Array<{ name: string; tsType: string }> = [];

      for (let i = 0; i < prepared.columnCount; i++) {
        columns.push({
          name: prepared.columnName(i),
          tsType: duckdbTypeObjToTS(prepared.columnType(i)),
        });
      }

      prepared.destroySync();
      typeInfos.push({ query: q, columns });
    }

    // Generate TypeScript
    console.log("Generating TypeScript types...");
    const output = generateTypeScript(typeInfos);

    // Write output
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, output, "utf-8");
    console.log(`Written to ${OUTPUT_FILE}`);

    // Cleanup temp files
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } finally {
    connection.closeSync();
    instance.closeSync();
  }
}

function generateTypeScript(
  typeInfos: Array<{
    query: ParsedQuery;
    columns: Array<{ name: string; tsType: string }>;
  }>,
): string {
  const lines: string[] = [];
  lines.push("// AUTO-GENERATED by scripts/generate-query-types.ts — DO NOT EDIT");
  lines.push("");

  // Generate params and result interfaces for each query
  for (const { query, columns } of typeInfos) {
    const pascal = toPascalCase(query.name);

    // Params interface
    if (query.params.length > 0) {
      lines.push(`/** Parameters for the '${query.name}' query */`);
      lines.push(`export interface ${pascal}Params {`);
      for (const param of query.params) {
        lines.push(`  ${param.name}: ${duckdbTypeToTS(param.duckdbType)};`);
      }
      lines.push("}");
    } else {
      lines.push(`/** Parameters for the '${query.name}' query (no parameters) */`);
      lines.push(
        `export type ${pascal}Params = Record<string, never>;`,
      );
    }
    lines.push("");

    // Result interface
    lines.push(`/** Result row for the '${query.name}' query */`);
    lines.push(`export interface ${pascal}Result {`);
    for (const col of columns) {
      lines.push(`  ${col.name}: ${col.tsType};`);
    }
    lines.push("}");
    lines.push("");
  }

  // QueryParamsMap
  lines.push("/** Maps query names to their parameter types */");
  lines.push("export interface QueryParamsMap {");
  for (const { query } of typeInfos) {
    const pascal = toPascalCase(query.name);
    lines.push(`  "${query.name}": ${pascal}Params;`);
  }
  lines.push("}");
  lines.push("");

  // QueryResultMap
  lines.push("/** Maps query names to their result row types */");
  lines.push("export interface QueryResultMap {");
  for (const { query } of typeInfos) {
    const pascal = toPascalCase(query.name);
    lines.push(`  "${query.name}": ${pascal}Result;`);
  }
  lines.push("}");
  lines.push("");

  // QueryName type
  lines.push("/** All valid query names */");
  lines.push("export type QueryName = keyof QueryResultMap;");
  lines.push("");

  return lines.join("\n");
}

main().catch((err) => {
  console.error("Failed to generate query types:", err);
  process.exit(1);
});
