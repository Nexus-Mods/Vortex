import * as fontkit from "fontkit";
import subsetFont from "subset-font";

/** The names in the `symbolNames` list, from the source of `ui/components/icon/symbols.ts`. */
export function parseSymbolNames(source) {
  const list = /export const symbolNames = \[([\s\S]*?)\] as const/.exec(source);

  if (list === null) {
    throw new Error("symbolNames was not found in symbols.ts");
  }

  return [...list[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

/**
 * Material Symbols' font cut down to the given symbols, of which the font draws each by their name,
 * as its ligature, so a symbol needs its glyph and the letters of its name, and nothing else.
 *
 * Subsetting by the letters alone would keep every symbol they can spell, which is nearly all of
 * them, and without the closure over ligatures it would keep none. So the symbols' own code
 * points are given too, with the closure off: the ligatures that survive are the ones whose
 * glyphs were asked for.
 *
 * @param {Uint8Array} font the full font, as the `material-symbols` package has it
 * @param {readonly string[]} names the symbols to keep
 * @returns {Promise<Buffer>} the subset, as WOFF2, with the font's variation axes intact
 */
export async function subsetSymbols(font, names) {
  const face = fontkit.create(Buffer.from(font));

  // A symbol's glyph has a code point of its own in the private use area, beside its ligature.
  const codePointOf = new Map();
  for (const codePoint of face.characterSet) {
    const { id } = face.glyphForCodePoint(codePoint);

    if (codePoint >= 0xe000 && !codePointOf.has(id)) {
      codePointOf.set(id, codePoint);
    }
  }

  const glyphs = names.map((name) => {
    const glyphIds = face.layout(name, ["liga"]).glyphs.map((glyph) => glyph.id);
    const codePoint = glyphIds.length === 1 ? codePointOf.get(glyphIds[0]) : undefined;

    if (codePoint === undefined) {
      throw new Error(`"${name}" is not a Material Symbol`);
    }

    return String.fromCodePoint(codePoint);
  });

  const letters = [...new Set(names.join(""))];

  return subsetFont(Buffer.from(font), [...letters, ...glyphs].join(""), {
    targetFormat: "woff2",
    noLayoutClosure: true,
  });
}
