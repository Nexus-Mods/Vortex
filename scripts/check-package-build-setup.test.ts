import * as fs from "node:fs";
import * as path from "node:path";

import { describe, it, expect } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Discover package.json files under packages/ and packages/adaptors/.
 * Skips directories that have no package.json (empty adaptor stubs).
 */
function discoverPackages(): {
  name: string;
  dir: string;
  pkg: Record<string, unknown>;
}[] {
  const results: {
    name: string;
    dir: string;
    pkg: Record<string, unknown>;
  }[] = [];

  for (const searchDir of ["packages", path.join("packages", "adaptors")]) {
    const abs = path.join(ROOT, searchDir);
    if (!fs.existsSync(abs)) continue;

    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = path.join(abs, entry.name, "package.json");
      if (!fs.existsSync(pkgPath)) continue;

      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      results.push({
        name: pkg.name ?? entry.name,
        dir: path.relative(ROOT, path.join(abs, entry.name)),
        pkg,
      });
    }
  }

  return results;
}

function hasRuntimeEntryPoint(pkg: Record<string, unknown>): boolean {
  return pkg.main !== undefined || pkg.module !== undefined || pkg.exports !== undefined;
}

function pointsToTs(value: unknown): boolean {
  return typeof value === "string" && /\.tsx?$/.test(value);
}

/** Conditions that are allowed to point to .ts source files. */
const ALLOWED_TS_CONDITIONS = new Set(["development", "types"]);

/**
 * Collect runtime export conditions that point to .ts files.
 * Walks the exports map and checks `import`, `require`, `default`, etc.
 * Skips `development` and `types` conditions which are allowed to use .ts.
 */
function findBrokenExportConditions(exports: unknown): { path: string; value: string }[] {
  const violations: { path: string; value: string }[] = [];

  if (typeof exports === "string") {
    if (pointsToTs(exports)) violations.push({ path: "exports", value: exports });
    return violations;
  }

  if (typeof exports !== "object" || exports === null) return violations;

  for (const [key, value] of Object.entries(exports as Record<string, unknown>)) {
    if (typeof value === "string") {
      // Top-level string (e.g. "./package.json": "./package.json") or
      // a condition value (e.g. "import": "./dist/index.mjs")
      if (!ALLOWED_TS_CONDITIONS.has(key) && pointsToTs(value)) {
        violations.push({ path: `exports["${key}"]`, value });
      }
    } else if (typeof value === "object" && value !== null) {
      // Subpath entry with condition keys
      for (const [condition, condValue] of Object.entries(value as Record<string, unknown>)) {
        if (
          typeof condValue === "string" &&
          !ALLOWED_TS_CONDITIONS.has(condition) &&
          pointsToTs(condValue)
        ) {
          violations.push({
            path: `exports["${key}"].${condition}`,
            value: condValue,
          });
        }
      }
    }
  }

  return violations;
}

// vortex-api is a type-only shim -- its "main" file doesn't exist on disk and
// it's resolved via webpack aliases at runtime, not through Node's require().
const EXCLUDED = new Set(["vortex-api"]);

const packages = discoverPackages().filter(
  (p) => hasRuntimeEntryPoint(p.pkg) && !EXCLUDED.has(p.name),
);

describe("workspace packages under packages/ must have a build setup", () => {
  for (const { name, dir, pkg } of packages) {
    describe(name, () => {
      it("has a build script", () => {
        const scripts = pkg.scripts as Record<string, string> | undefined;
        expect(scripts?.build, `${dir}/package.json is missing a "build" script`).toBeDefined();
      });

      it("main does not point to .ts source", () => {
        if (pkg.main === undefined) return;
        expect(
          pointsToTs(pkg.main),
          `${dir}/package.json "main" points to TypeScript source (${pkg.main}). It must point to compiled output.`,
        ).toBe(false);
      });

      it("module does not point to .ts source", () => {
        if (pkg.module === undefined) return;
        expect(
          pointsToTs(pkg.module),
          `${dir}/package.json "module" points to TypeScript source (${pkg.module}). It must point to compiled output.`,
        ).toBe(false);
      });

      it("runtime export conditions do not point to .ts source", () => {
        if (pkg.exports === undefined) return;
        const violations = findBrokenExportConditions(pkg.exports);
        expect(
          violations,
          `${dir}/package.json has export conditions pointing to TypeScript source:\n` +
            violations.map((v) => `  ${v.path}: "${v.value}"`).join("\n") +
            "\nRuntime conditions (import, require, default) must point to compiled output." +
            "\nUse the 'development' condition for dev-time .ts resolution.",
        ).toHaveLength(0);
      });
    });
  }
});
