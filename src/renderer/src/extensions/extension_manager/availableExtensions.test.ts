import { describe, expect, it } from "vitest";

import { makeAvailableExtension } from "../../test-utils/builders";
import type {
  VortexAsset,
  VortexData,
  VortexExtension,
  VortexTranslation,
} from "./availableExtensions";
import {
  dedupeGameExtensions,
  mapAvailableExtensions,
  parseTranslationLocale,
} from "./availableExtensions";

function makeAsset(overrides: Partial<VortexAsset> = {}): VortexAsset {
  return {
    name: "Test Extension",
    version: "1.2.0",
    author_name: "Uploader",
    author_user_id: "54321",
    uploaded_at: "2023-11-14T22:13:20Z",
    mod_id: "123",
    file_id: "456",
    image_url: "https://example.invalid/image.jpg",
    ...overrides,
  };
}

function makeWireExtension(overrides: Partial<VortexExtension> = {}): VortexExtension {
  return { ...makeAsset(), type: "other", ...overrides };
}

function makeTranslation(overrides: Partial<VortexTranslation> = {}): VortexTranslation {
  const { locale = "en", ...rest } = overrides;
  return { ...makeAsset(), locale, ...rest };
}

function makeData(overrides: Partial<VortexData> = {}): VortexData {
  return { extensions: [], themes: [], translations: [], ...overrides };
}

describe("mapAvailableExtensions", () => {
  it("maps a game extension, converting ids and the upload time", () => {
    const data = makeData({
      extensions: [makeWireExtension({ type: "game", game_id: "7" })],
    });

    expect(mapAvailableExtensions(data)).toEqual([
      {
        name: "Test Extension",
        modId: 123,
        fileId: 456,
        author: "Uploader",
        version: "1.2.0",
        timestamp: Date.parse("2023-11-14T22:13:20Z"),
        image: "https://example.invalid/image.jpg",
        type: "game",
        gameId: 7,
        language: undefined,
      },
    ]);
  });

  it("maps an 'other' extension to no type", () => {
    const data = makeData({ extensions: [makeWireExtension()] });
    expect(mapAvailableExtensions(data)[0].type).toBeUndefined();
  });

  it("maps themes and translations to their extension types", () => {
    const data = makeData({
      themes: [makeAsset({ name: "Some Theme" })],
      translations: [makeTranslation({ locale: "de" })],
    });

    const [theme, translation] = mapAvailableExtensions(data);
    expect(theme.type).toBe("theme");
    expect(translation.type).toBe("translation");
    expect(translation.language).toBe("de");
  });

  it("passes a BCP 47 script subtag from the API through unchanged", () => {
    const data = makeData({
      translations: [makeTranslation({ locale: "zh-Hans" })],
    });

    expect(mapAvailableExtensions(data)[0].language).toBe("zh-Hans");
  });

  it("falls back to parseTranslationLocale when the API locale is null", () => {
    const data = makeData({
      translations: [makeTranslation({ locale: null, name: "Vortex Translation (pt-BR)" })],
    });

    expect(mapAvailableExtensions(data)[0].language).toBe("pt-BR");
  });

  it("drops entries whose ids do not parse", () => {
    const data = makeData({
      extensions: [makeWireExtension({ mod_id: "not-a-number" }), makeWireExtension()],
    });
    expect(mapAvailableExtensions(data)).toHaveLength(1);
  });

  it("drops entries with blank ids", () => {
    const data = makeData({
      extensions: [makeWireExtension({ mod_id: "" }), makeWireExtension({ file_id: " " })],
    });
    expect(mapAvailableExtensions(data)).toHaveLength(0);
  });

  it("maps a blank game_id to no gameId", () => {
    const data = makeData({ extensions: [makeWireExtension({ type: "game", game_id: "" })] });
    expect(mapAvailableExtensions(data)[0].gameId).toBeUndefined();
  });

  it("maps a null image to undefined", () => {
    const data = makeData({ extensions: [makeWireExtension({ image_url: null })] });
    expect(mapAvailableExtensions(data)[0].image).toBeUndefined();
  });

  it("maps an unparseable upload time to 0", () => {
    const data = makeData({ extensions: [makeWireExtension({ uploaded_at: "garbage" })] });
    expect(mapAvailableExtensions(data)[0].timestamp).toBe(0);
  });
});

describe("dedupeGameExtensions", () => {
  const contender = (modId: number, gameId: number, timestamp = 0) =>
    makeAvailableExtension({ name: `ext-${modId}`, modId, type: "game", gameId, timestamp });

  it("keeps the most endorsed extension of a contested game", () => {
    const broken = contender(1361, 1955);
    const curated = contender(1547, 1955);

    const result = dedupeGameExtensions([broken, curated], { 1361: 2, 1547: 43 });
    expect(result).toEqual([curated]);
  });

  it("breaks endorsement ties by newest upload", () => {
    const older = contender(1, 7, 1000);
    const newer = contender(2, 7, 2000);

    expect(dedupeGameExtensions([newer, older], {})).toEqual([newer]);
  });

  it("treats a missing endorsement count as zero", () => {
    const unknown = contender(1, 7, 2000);
    const endorsed = contender(2, 7, 1000);

    expect(dedupeGameExtensions([unknown, endorsed], { 2: 1 })).toEqual([endorsed]);
  });

  it("keeps uncontested games and preserves order", () => {
    const solo = contender(1, 7);
    const winner = contender(2, 8);
    const loser = contender(3, 8);
    const anotherSolo = contender(4, 9);

    const result = dedupeGameExtensions([solo, winner, loser, anotherSolo], { 2: 5 });
    expect(result).toEqual([solo, winner, anotherSolo]);
  });

  it("passes through non-game entries and game extensions without a game ID", () => {
    const theme = makeAvailableExtension({ name: "theme", modId: 5, type: "theme" });
    const translation = makeAvailableExtension({
      name: "translation",
      modId: 6,
      type: "translation",
    });
    const unresolved = makeAvailableExtension({ name: "unresolved", modId: 7, type: "game" });

    const result = dedupeGameExtensions([theme, translation, unresolved], {});
    expect(result).toEqual([theme, translation, unresolved]);
  });
});

describe("parseTranslationLocale", () => {
  it("prefers an explicit locale code, normalizing its case", () => {
    expect(parseTranslationLocale("Vortex Translation (pt-BR)")).toBe("pt-BR");
    expect(parseTranslationLocale("Vortex Translation (DE)")).toBe("de");
  });

  it("matches an English language name", () => {
    expect(parseTranslationLocale("Polish Translation for Vortex")).toBe("pl");
  });

  it("matches any name of a multi-name entry", () => {
    // languagemap lists es as "Spanish; Castilian"
    expect(parseTranslationLocale("Spanish Translation")).toBe("es");
    expect(parseTranslationLocale("Castilian Translation")).toBe("es");
  });

  it("matches multi-word language names", () => {
    // languagemap lists gd as "Scottish Gaelic; Gaelic"
    expect(parseTranslationLocale("Scottish Gaelic Translation")).toBe("gd");
  });

  it("returns undefined when nothing matches", () => {
    expect(parseTranslationLocale("Vortex Community Pack")).toBeUndefined();
  });
});
