import { describe, expect, it } from "vitest";

import { buildLanguageOptions, type ILanguage } from "./languageOptions";

// identity translation, so labels are asserted verbatim
const t = (input: string) => input;

// At runtime language.ext entries are IAvailableExtension objects (they carry `author`),
// though ILanguage types them as the narrower Partial<IExtensionDownloadInfo>. Mirror
// that here so tests can set an author the way the app does.
const ext = (props: { name?: string; author?: string; modId?: number }): ILanguage["ext"][number] =>
  props;

describe("buildLanguageOptions", () => {
  it("produces one option for a bundled language with no extensions", () => {
    const languages: ILanguage[] = [{ key: "en", language: "English", ext: [] }];

    expect(buildLanguageOptions(languages, t)).toEqual([
      { id: "en::local", key: "en", extName: undefined, label: "English" },
    ]);
  });

  it("includes the country in the label when present", () => {
    const languages: ILanguage[] = [
      { key: "en-GB", language: "English", country: "United Kingdom", ext: [] },
    ];

    expect(buildLanguageOptions(languages, t)[0].label).toBe("English (United Kingdom)");
  });

  it("uses the single extension and adds an author suffix when it has a modId", () => {
    const languages: ILanguage[] = [
      { key: "de", language: "German", ext: [ext({ name: "de-ext", author: "Alice", modId: 42 })] },
    ];

    expect(buildLanguageOptions(languages, t)).toEqual([
      { id: "de::de-ext", key: "de", extName: "de-ext", label: "German (Extension by Alice)" },
    ]);
  });

  it("omits the author suffix for a single extension without a modId", () => {
    const languages: ILanguage[] = [{ key: "fr", language: "French", ext: [{ name: "fr-local" }] }];

    const [option] = buildLanguageOptions(languages, t);
    expect(option.label).toBe("French");
    expect(option.extName).toBe("fr-local");
  });

  it("emits one distinct option per extension when a language has two or more", () => {
    const languages: ILanguage[] = [
      {
        key: "pl",
        language: "Polish",
        ext: [
          ext({ name: "pl-a", author: "Alice", modId: 1 }),
          ext({ name: "pl-b", author: "Bob", modId: 2 }),
        ],
      },
    ];

    expect(buildLanguageOptions(languages, t)).toEqual([
      { id: "pl::pl-a", key: "pl", extName: "pl-a", label: "Polish (Extension by Alice)" },
      { id: "pl::pl-b", key: "pl", extName: "pl-b", label: "Polish (Extension by Bob)" },
    ]);
  });

  it("falls back to 'unknown author' when an extension with a modId has no author", () => {
    const languages: ILanguage[] = [
      { key: "es", language: "Spanish", ext: [{ name: "es-ext", modId: 7 }] },
    ];

    expect(buildLanguageOptions(languages, t)[0].label).toBe(
      "Spanish (Extension by unknown author)",
    );
  });
});
