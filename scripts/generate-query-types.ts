/**
 * Build-time script to generate TypeScript types from SQL query definitions.
 *
 * Run after adding or modifying .sql files in src/queries/ so that the
 * generated TypeScript interfaces stay in sync with the SQL schema.
 *
 * Usage (from repo root):
 *   pnpm run generate:query-types
 *
 * What it does:
 * 1. Creates a temporary DuckDB instance + loads level_pivot
 * 2. ATTACHes a temp empty LevelDB (for schema-only operation)
 * 3. Runs all `setup` queries (pivot table definitions)
 * 4. Runs all `view` queries (creates views)
 * 5. For each `select` query: prepares the statement, reads column metadata
 * 6. Maps DuckDB types to TypeScript types
 * 7. Writes output to src/main/src/store/generated/queryTypes.ts
 */

import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";

// Resolve @duckdb/node-api from the @vortex/main workspace where it is declared
// as a dependency, since this script lives at the repo root.
const mainRequire = createRequire(
  path.resolve(__dirname, "..", "src", "main", "package.json"),
);

import type {
  DuckDBConnection,
  DuckDBInstance,
  DuckDBType,
} from "@duckdb/node-api";

// Import the parser from source
import { parseAllQueries } from "../src/main/src/store/queryParser";
import type { ParsedQuery } from "../src/main/src/store/queryParser";

const QUERIES_DIR = path.resolve(__dirname, "..", "src", "queries");
const OUTPUT_FILE = path.resolve(
  __dirname,
  "..",
  "src",
  "main",
  "src",
  "store",
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

/** Convert snake_case to camelCase */
function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Derive the property name for a model accessor */
function derivePropertyName(
  query: ParsedQuery,
  type: "table" | "view",
): string {
  if (query.alias) {
    return query.alias;
  }
  let name = query.name;
  if (type === "table" && name.endsWith("_pivot")) {
    name = name.slice(0, -"_pivot".length);
  }
  return toCamelCase(name);
}

interface TableTypeInfo {
  query: ParsedQuery;
  propName: string;
  columns: Array<{ name: string; tsType: string }>;
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
  const { DuckDBInstance: DuckDBInstanceCtor } =
    mainRequire("@duckdb/node-api");
  const instance: DuckDBInstance = await DuckDBInstanceCtor.create(":memory:", {
    allow_unsigned_extensions: "true",
  });
  const connection: DuckDBConnection = await instance.connect();

  // Create a temp LevelDB for schema-only operation (hoisted for cleanup after shutdown)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vortex-gen-"));

  try {
    // Install and load level_pivot
    console.log("Installing level_pivot...");
    await connection.run("INSTALL level_pivot FROM community");
    await connection.run("LOAD level_pivot");
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

    // Introspect pivot tables from setup queries
    const tableTypeInfos: TableTypeInfo[] = [];

    for (const q of setupQueries) {
      console.log(`  Describing table: ${q.name}`);
      const descResult = await connection.runAndReadAll(
        `DESCRIBE db.${q.name}`,
      );
      const descRows = descResult.getRowObjectsJson() as Array<{
        column_name: string;
        column_type: string;
      }>;

      const columns = descRows.map((row) => ({
        name: row.column_name,
        tsType: duckdbTypeToTS(row.column_type),
      }));

      tableTypeInfos.push({
        query: q,
        propName: derivePropertyName(q, "table"),
        columns,
      });
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
    const output = generateTypeScript(tableTypeInfos, typeInfos);

    // Write output
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, output, "utf-8");
    console.log(`Written to ${OUTPUT_FILE}`);

    // Detach before closing so the temp LevelDB files are released
    await connection.run("DETACH db");
  } finally {
    connection.closeSync();
    instance.closeSync();
  }

  // Cleanup temp files after DuckDB is fully shut down
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

function generateTypeScript(
  tableTypeInfos: TableTypeInfo[],
  selectTypeInfos: Array<{
    query: ParsedQuery;
    columns: Array<{ name: string; tsType: string }>;
  }>,
): string {
  const lines: string[] = [];
  lines.push(
    "// AUTO-GENERATED by scripts/generate-query-types.ts — DO NOT EDIT",
  );
  lines.push("");
  lines.push('import type { Table } from "../Table";');
  lines.push('import type { Database } from "../Database";');
  lines.push("");

  // Pivot table Row interfaces
  for (const { query, columns } of tableTypeInfos) {
    const pascal = toPascalCase(query.name);
    lines.push(`/** Row type for the '${query.name}' pivot table */`);
    lines.push(`export type ${pascal}Row = {`);
    for (const col of columns) {
      lines.push(`  ${col.name}: ${col.tsType};`);
    }
    lines.push("};");
    lines.push("");
  }

  // Select query Params and Row interfaces
  for (const { query, columns } of selectTypeInfos) {
    const pascal = toPascalCase(query.name);

    if (query.params.length > 0) {
      lines.push(`/** Parameters for the '${query.name}' query */`);
      lines.push(`export interface ${pascal}Params {`);
      for (const param of query.params) {
        lines.push(`  ${param.name}: ${duckdbTypeToTS(param.duckdbType)};`);
      }
      lines.push("}");
    } else {
      lines.push(
        `/** Parameters for the '${query.name}' query (no parameters) */`,
      );
      lines.push(`export type ${pascal}Params = Record<string, never>;`);
    }
    lines.push("");

    lines.push(`/** Result row for the '${query.name}' query */`);
    lines.push(`export interface ${pascal}Row {`);
    for (const col of columns) {
      lines.push(`  ${col.name}: ${col.tsType};`);
    }
    lines.push("}");
    lines.push("");
  }

  // Models interface
  lines.push("/** Typed model accessors — generated from SQL definitions */");
  lines.push("export interface Models {");
  for (const { query, propName } of tableTypeInfos) {
    const pascal = toPascalCase(query.name);
    lines.push(`  ${propName}: Table<${pascal}Row>;`);
  }
  for (const { query } of selectTypeInfos) {
    if (query.params.length === 0) {
      const pascal = toPascalCase(query.name);
      const propName = derivePropertyName(query, "view");
      lines.push(`  ${propName}: View<${pascal}Row>;`);
    }
  }
  lines.push("}");
  lines.push("");

  // createModels factory
  lines.push("/** Create typed model accessors from a Database instance */");
  lines.push("export function createModels(db: Database): Models {");
  lines.push("  return {");
  for (const { query, propName } of tableTypeInfos) {
    lines.push(`    ${propName}: db.createTable("${query.name}"),`);
  }
  for (const { query } of selectTypeInfos) {
    if (query.params.length === 0) {
      const propName = derivePropertyName(query, "view");
      lines.push(`    ${propName}: db.createView("${query.name}"),`);
    }
  }
  lines.push("  } as Models;");
  lines.push("}");
  lines.push("");

  // QueryParamsMap
  lines.push("/** Maps query names to their parameter types */");
  lines.push("export interface QueryParamsMap {");
  for (const { query } of selectTypeInfos) {
    const pascal = toPascalCase(query.name);
    lines.push(`  "${query.name}": ${pascal}Params;`);
  }
  lines.push("}");
  lines.push("");

  // QueryResultMap (now uses Row suffix)
  lines.push("/** Maps query names to their result row types */");
  lines.push("export interface QueryResultMap {");
  for (const { query } of selectTypeInfos) {
    const pascal = toPascalCase(query.name);
    lines.push(`  "${query.name}": ${pascal}Row;`);
  }
  lines.push("}");
  lines.push("");

  lines.push("/** All valid query names */");
  lines.push("export type QueryName = keyof QueryResultMap;");
  lines.push("");

  return lines.join("\n");
}

main().catch((err) => {
  console.error("Failed to generate query types:", err);
  process.exit(1);
});
