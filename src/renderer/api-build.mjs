import { existsSync } from "node:fs";
import * as path from "node:path";

import { rolldown, defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const libDir = path.resolve(import.meta.dirname, "lib");

/**
 * Resolves the renderer's `@/` path alias (see tsconfig.api.json) against the
 * declarations tsc emitted into `lib/`. Without this the alias reaches the
 * published api.d.ts as `from "@/..."`, which no extension can resolve.
 */
const resolvePathAlias = {
  name: "resolve-path-alias",
  resolveId: {
    // Ahead of the dts plugin, which would map it through tsconfig paths to `src/`.
    order: "pre",
    handler(id) {
      if (!id.startsWith("@/")) return null;

      const base = path.join(libDir, id.slice(2));
      for (const candidate of [`${base}.d.ts`, path.join(base, "index.d.ts")]) {
        if (existsSync(candidate)) return candidate;
      }

      throw new Error(`api-build: can't resolve "${id}" in ${libDir}`);
    },
  },
};

const config = defineConfig({
  // `ui` is also published as its own entry, `@nexusmods/vortex-api/ui`.
  // Declarations both entries share are split into a chunk next to them.
  input: { api: "lib/api.d.ts", ui: "lib/ui/api.d.ts" },
  plugins: [
    resolvePathAlias,
    dts({
      emitDtsOnly: true,
      tsconfig: "tsconfig.api.json",
      dtsInput: true,
    }),
  ],
  output: {
    dir: path.resolve(import.meta.dirname, "..", "..", "packages", "vortex-api", "lib"),
    // A fixed name, so the published file list and nx outputs don't churn.
    chunkFileNames: "shared.d.ts",
  },
  external: (id) => {
    if (id.startsWith(".")) return false;
    if (id.startsWith("@/")) return false;
    if (path.isAbsolute(id)) return false;
    if (id.startsWith("@vortex/shared")) return false;

    return true;
  },
});

const build = await rolldown(config);
await build.write(config.output);
