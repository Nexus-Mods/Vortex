import * as fs from "node:fs";
import * as path from "node:path";

export type QueryType = "setup" | "view" | "select";

export interface ParsedQueryParam {
  name: string;
  duckdbType: string;
}

export interface ParsedQuery {
  name: string;
  type: QueryType;
  sql: string;
  params: ParsedQueryParam[];
  description: string;
  filePath: string;
}

/**
 * Parse a single .sql file containing one or more queries.
 * File format:
 *   -- @type setup|view|select     (file-level, required, declared once)
 *   -- @name query_name            (starts a new query)
 *   -- @description ...            (optional description)
 *   -- @param param_name TYPE      (optional, for select queries)
 *   SQL body...
 */
function parseFile(filePath: string, content: string): ParsedQuery[] {
  const lines = content.split("\n");
  const queries: ParsedQuery[] = [];

  let fileType: QueryType | undefined;
  let currentName: string | undefined;
  let currentDescription = "";
  let currentParams: ParsedQueryParam[] = [];
  let currentSqlLines: string[] = [];

  function flushQuery() {
    if (currentName !== undefined && fileType !== undefined) {
      const sql = currentSqlLines.join("\n").trim();
      if (sql.length > 0) {
        queries.push({
          name: currentName,
          type: fileType,
          sql,
          params: currentParams,
          description: currentDescription,
          filePath,
        });
      }
    }
    currentName = undefined;
    currentDescription = "";
    currentParams = [];
    currentSqlLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Parse @type (file-level)
    const typeMatch = trimmed.match(/^--\s*@type\s+(setup|view|select)\s*$/);
    if (typeMatch !== null) {
      fileType = typeMatch[1] as QueryType;
      continue;
    }

    // Parse @name (starts a new query)
    const nameMatch = trimmed.match(/^--\s*@name\s+(\S+)\s*$/);
    if (nameMatch !== null) {
      flushQuery();
      currentName = nameMatch[1];
      continue;
    }

    // Parse @description
    const descMatch = trimmed.match(/^--\s*@description\s+(.+)$/);
    if (descMatch !== null) {
      currentDescription = descMatch[1].trim();
      continue;
    }

    // Parse @param
    const paramMatch = trimmed.match(/^--\s*@param\s+(\S+)\s+(\S+)\s*$/);
    if (paramMatch !== null) {
      currentParams.push({
        name: paramMatch[1],
        duckdbType: paramMatch[2],
      });
      continue;
    }

    // Skip plain comment lines that are annotation-like but not recognized
    // Collect SQL lines (including empty lines and non-annotation comments)
    if (currentName !== undefined) {
      currentSqlLines.push(line);
    }
  }

  // Flush final query
  flushQuery();

  if (fileType === undefined && queries.length > 0) {
    throw new Error(`Missing @type declaration in ${filePath}`);
  }

  return queries;
}

/**
 * Recursively find all .sql files in a directory.
 */
function findSqlFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findSqlFiles(fullPath));
    } else if (entry.name.endsWith(".sql")) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Parse all .sql files in the queries directory tree.
 * Validates name uniqueness across all files.
 */
export function parseAllQueries(queriesDir: string): ParsedQuery[] {
  const sqlFiles = findSqlFiles(queriesDir);
  const allQueries: ParsedQuery[] = [];
  const nameSet = new Map<string, string>(); // name -> filePath

  for (const filePath of sqlFiles) {
    const content = fs.readFileSync(filePath, "utf-8");
    const queries = parseFile(filePath, content);

    for (const query of queries) {
      const existing = nameSet.get(query.name);
      if (existing !== undefined) {
        throw new Error(
          `Duplicate query name '${query.name}' found in ${filePath} and ${existing}`,
        );
      }
      nameSet.set(query.name, filePath);
      allQueries.push(query);
    }
  }

  return allQueries;
}
