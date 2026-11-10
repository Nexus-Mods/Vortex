import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

// Tests get the key back from `t`, so only this sees a key the code names but the strings lack.
const REPO_ROOT = path.resolve(__dirname, "../../../../../..");
const RENDERER_SRC = path.join(REPO_ROOT, "src/renderer/src");

type Strings = { [key: string]: string | Strings };

const strings = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "locales/en/mod_management.json"), "utf8"),
) as Strings;

// A quoted key with every part spelled out; one built from a variable can't be checked here.
const QUOTED_KEY = /["'`]([A-Za-z_]+(?:::[A-Za-z0-9_]+)+)["'`]/g;

/** Every key of the namespace the renderer's code names, with the file naming it. */
const keysInCode = () =>
  fs
    .readdirSync(RENDERER_SRC, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .flatMap((file) =>
      Array.from(fs.readFileSync(path.join(RENDERER_SRC, file), "utf8").matchAll(QUOTED_KEY))
        .map(([, key]) => ({ key, file }))
        .filter(({ key }) => typeof strings[key.split("::")[0]] === "object"),
    );

/** Whether a key has a string, as itself or as the plural forms i18next picks between. */
const hasString = (key: string) => {
  const parts = key.split("::");
  const last = parts.pop() ?? "";
  const parent = parts.reduce<Strings | string | undefined>(
    (node, part) => (typeof node === "object" ? node[part] : undefined),
    strings,
  );

  return (
    typeof parent === "object" &&
    [last, `${last}_plural`, `${last}_one`].some((form) => typeof parent[form] === "string")
  );
};

describe("mod_management's English strings", () => {
  it("has one for every key the code names", () => {
    const keys = keysInCode();

    // Found at all, so an empty list below isn't the scan missing them.
    expect(keys.map(({ key }) => key)).toContain("modsTable::columns::name");
    expect(keys.filter(({ key }) => !hasString(key))).toEqual([]);
  });
});
