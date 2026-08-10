import type { IExtensionDownloadInfo } from "../../types/extensions";

export interface ILanguage {
  key: string;
  language: string;
  country?: string;
  ext: Array<Partial<IExtensionDownloadInfo>>;
}

/**
 * A single selectable language entry. The `Picker` is keyed purely by value, so we
 * flatten the languages-with-extensions structure into one entry per option and key it
 * by a composite `id` (a language may be provided by more than one extension, giving
 * several options that share the same `key`). `extName` carries what the old
 * `<option data-ext>` did — the extension to install on selection.
 */
export interface ILanguageOption {
  id: string;
  key: string;
  extName?: string;
  label: string;
}

export function languageName(language: ILanguage): string {
  return language.country === undefined
    ? language.language
    : `${language.language} (${language.country})`;
}

/**
 * Flatten `languages` into one `ILanguageOption` per selectable entry, mirroring the
 * option set the old react-bootstrap `<select>` produced: a language with fewer than two
 * extensions yields a single option (using its first ext if present), otherwise one
 * option per extension. Each option carries a composite `id` so same-key entries stay
 * distinct, and `extName` so selection can trigger the extension install as before.
 */
export function buildLanguageOptions(
  languages: ILanguage[],
  t: (input: string) => string,
): ILanguageOption[] {
  const optionFor = (
    language: ILanguage,
    ext: Partial<IExtensionDownloadInfo>,
  ): ILanguageOption => ({
    id: `${language.key}::${ext.name ?? "local"}`,
    key: language.key,
    extName: ext.name,
    label:
      ext.modId !== undefined
        ? `${languageName(language)} (${t("Extension")} by ${ext["author"] || "unknown author"})`
        : languageName(language),
  });

  return languages.reduce<ILanguageOption[]>((prev, language) => {
    if (language.ext.length < 2) {
      prev.push(
        optionFor(language, language.ext.length > 0 ? language.ext[0] : { name: undefined }),
      );
    } else {
      language.ext.forEach((ext) => prev.push(optionFor(language, ext)));
    }
    return prev;
  }, []);
}
