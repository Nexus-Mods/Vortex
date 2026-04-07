import type { Plugin } from "rolldown";

/**
 * A rolldown plugin that generates a `virtual:services` module.
 * Each alias becomes an eagerly-resolved export from the runtime container.
 * The container must be activated before the bundle is evaluated (the Worker
 * bootstrap handles this).
 *
 * @param aliases - A map of friendly export names to their fully-qualified
 *   service URIs, e.g. `{ ping: "vortex:host/ping" }`.
 */
export function vortexAdaptorPlugin(aliases: Record<string, string>): Plugin {
  return {
    name: "vortex-adaptor",

    resolveId(source) {
      if (source === "virtual:services") {
        return "\0virtual:services";
      }
    },

    load(id) {
      if (id === "\0virtual:services") {
        const imports = `import { getContainer } from "@vortex/adaptor-api";\nconst __container = getContainer();\n`;
        const exports = Object.entries(aliases)
          .map(
            ([name, uri]) =>
              `export const ${name} = __container.resolve(${JSON.stringify(uri)});`,
          )
          .join("\n");
        return imports + exports;
      }
    },
  };
}
