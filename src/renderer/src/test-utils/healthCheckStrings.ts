import * as fs from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(__dirname, "../../../..");

type Strings = { [key: string]: string | Strings };

const englishStrings = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "locales/en/health_check.json"), "utf8"),
) as Strings;

/**
 * `t` backed by the real English strings, for tests about what a component says.
 *
 * The shared stub in test-setup.mts hands back the key, which is right for tests that only
 * care that a key was used. A test asserting the wording needs the wording, and reading it
 * from locales/en also fails when the code names a key the file does not have.
 *
 * Keys are written the way the app writes them (`listing::fomod_options::change_options`);
 * `{{placeholder}}` is filled from the options.
 */
export const healthCheckT = (key: string, options: Record<string, unknown> = {}): string => {
  const parts = key.split("::");
  const last = parts.pop() ?? "";
  const parent = parts.reduce<Strings | string | undefined>(
    (node, part) => (typeof node === "object" ? node[part] : undefined),
    englishStrings,
  );

  const template = typeof parent === "object" ? parent[last] : undefined;

  return typeof template === "string"
    ? template.replace(/{{(\w+)}}/g, (_, name: string) => {
        const value = options[name];
        return typeof value === "string" || typeof value === "number" ? String(value) : "";
      })
    : key;
};
