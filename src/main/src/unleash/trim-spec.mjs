#!/usr/bin/env node
// Trims openapi.json to only the paths and schemas needed by client.ts.
// Run before openapi-typescript to keep schema.d.ts small.
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(join(dir, "openapi.json"), "utf8"));

const KEEP_PATHS = ["/api/frontend"];

function collectSchemas(obj, schemas, needed) {
  if (typeof obj !== "object" || obj === null) return;
  if (obj.$ref) {
    const name = obj.$ref.replace("#/components/schemas/", "");
    if (!needed.has(name)) {
      needed.add(name);
      collectSchemas(schemas[name], schemas, needed);
    }
    return;
  }
  for (const v of Object.values(obj)) collectSchemas(v, schemas, needed);
}

const needed = new Set();
const paths = {};
for (const p of KEEP_PATHS) {
  paths[p] = spec.paths[p];
  collectSchemas(spec.paths[p], spec.components.schemas, needed);
}

const trimmed = {
  ...spec,
  paths,
  components: {
    ...spec.components,
    schemas: Object.fromEntries([...needed].map((name) => [name, spec.components.schemas[name]])),
  },
};

const out = join(dir, "openapi-slim.json");
writeFileSync(out, JSON.stringify(trimmed, null, 2));
console.log(`Kept ${KEEP_PATHS.length} path(s), ${needed.size} schema(s) → ${out}`);
