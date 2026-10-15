import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

import * as fontkit from "fontkit";
import { beforeAll, describe, expect, it } from "vitest";

import { parseSymbolNames, subsetSymbols } from "./subsetSymbols.mjs";

// --- Helpers ---

const WORKSPACE = path.resolve(import.meta.dirname, "../../..");

const loadFont = (): Buffer => {
  const rendererRequire = createRequire(path.join(WORKSPACE, "src/renderer/package.json"));
  const dir = path.dirname(rendererRequire.resolve("material-symbols/package.json"));

  return fs.readFileSync(path.join(dir, "material-symbols-outlined.woff2"));
};

/** How many glyphs a symbol's name comes to: one when the font draws it, a letter each if not. */
const glyphCount = (font: Uint8Array, name: string): number =>
  (fontkit.create(Buffer.from(font)) as fontkit.Font).layout(name, ["liga"]).glyphs.length;

// --- Tests ---

describe("parseSymbolNames", () => {
  it("reads the names of the symbolNames list", () => {
    const source = `
      import type { MaterialSymbol } from "material-symbols";
      export const symbolNames = [
        "add",
        "arrow_back",
      ] as const satisfies readonly MaterialSymbol[];
      export type SymbolName = (typeof symbolNames)[number];
    `;
    expect(parseSymbolNames(source)).toEqual(["add", "arrow_back"]);
  });

  it("reads the list the Icon component has", () => {
    const names = parseSymbolNames(
      fs.readFileSync(
        path.join(WORKSPACE, "src/renderer/src/ui/components/icon/symbols.ts"),
        "utf8",
      ),
    );
    expect(names.length).toBeGreaterThan(100);
    expect(names).toContain("settings");
  });

  it("throws when there is no list", () => {
    expect(() => parseSymbolNames("export const other = [] as const")).toThrow(/symbolNames/);
  });
});

describe("subsetSymbols", () => {
  let full: Buffer;
  let subset: Buffer;

  beforeAll(async () => {
    full = loadFont();
    subset = await subsetSymbols(full, ["settings", "arrow_back", "rule"]);
  }, 60_000);

  it("keeps a small part of the font", () => {
    expect(subset.length).toBeLessThan(full.length / 20);
  });

  it("still draws each symbol it was given, by its name", () => {
    for (const name of ["settings", "arrow_back", "rule"]) {
      expect(glyphCount(subset, name)).toBe(1);
    }
  });

  it("drops the symbols it was not given", () => {
    for (const name of ["home", "star", "accessibility"]) {
      expect(glyphCount(subset, name)).toBeGreaterThan(1);
    }
  });

  it("keeps the font's variation axes", () => {
    const axes = Object.keys((fontkit.create(subset) as fontkit.Font).variationAxes).sort();
    expect(axes).toEqual(["FILL", "GRAD", "opsz", "wght"]);
  });

  it("draws every symbol the Icon component lists", async () => {
    const names = parseSymbolNames(
      fs.readFileSync(
        path.join(WORKSPACE, "src/renderer/src/ui/components/icon/symbols.ts"),
        "utf8",
      ),
    );
    const all = await subsetSymbols(full, names);

    for (const name of names) {
      expect(glyphCount(all, name), name).toBe(1);
    }
  }, 60_000);

  it("throws on a name that is not a symbol", async () => {
    await expect(subsetSymbols(full, ["settings", "not_a_symbol"])).rejects.toThrow(/not_a_symbol/);
  }, 60_000);
});
