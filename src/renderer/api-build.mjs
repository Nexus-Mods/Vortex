import * as path from "node:path";

import { rolldown, defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const libDir = path.resolve(import.meta.dirname, "lib");

/**
 * `tsc` keeps the `@/*` path alias as written in the declarations it emits to `lib/`.
 * The dts plugin resolves that alias through the tsconfig's `paths`, which point at
 * `src/`, not at the emitted declarations. Point it at `lib/` so the types are inlined
 * instead of left as `@/...` imports that extension authors can't resolve.
 */
const resolvePathAlias = {
  name: "vortex:resolve-path-alias",
  resolveId: {
    order: "pre",
    handler(id, importer, options) {
      if (!id.startsWith("@/")) return null;
      return this.resolve(path.join(libDir, id.slice(2)), importer, options);
    },
  },
};

const config = defineConfig({
  input: "lib/api.d.ts",
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
  },
  external: (id) => {
    if (id.startsWith(".")) return false;
    if (path.isAbsolute(id)) return false;
    // The `@/*` alias is our own source; `resolvePathAlias` above inlines it.
    if (id.startsWith("@/")) return false;
    if (id.startsWith("@vortex/shared")) return false;
    // Extensions don't install it; the symbol names are inlined so `menuIcon` still checks them.
    if (id === "material-symbols") return false;

    return true;
  },
});

const build = await rolldown(config);
const { output } = await build.write(config.output);

// `@/*` only means something inside this repo, and `@nexusmods/vortex-api`'s typecheck
// runs with skipLibCheck, so an alias left in the bundle would otherwise go unnoticed.
const leftovers = output
  .filter((chunk) => chunk.type === "chunk")
  .flatMap((chunk) =>
    [...chunk.code.matchAll(/["'](@\/[^"']+)["']/g)].map((m) => `${chunk.fileName}: ${m[1]}`),
  );
if (leftovers.length > 0) {
  throw new Error(
    `The API declarations still import the internal "@/" alias, which extensions can't resolve:\n` +
      [...new Set(leftovers)].join("\n"),
  );
}
