/**
 * BCP 47 language tag helpers built on the platform Intl APIs.
 */

/**
 * Canonicalise a BCP 47 language tag.
 *
 * Returns the canonical Intl.Locale form (lower-cased language, capitalised
 * script and region), or undefined if the input is not a well-formed BCP 47 tag.
 *
 * Accepts: "de", "pt-BR", "zh-Hans", "zh-Hant-CN", " DE ".
 * Rejects: null, undefined, "", "not a tag", "en_US" (underscore is not BCP 47).
 */
export function parseBcp47(
  input: string | null | undefined,
): Intl.UnicodeBCP47LocaleIdentifier | undefined {
  if (typeof input !== "string") return undefined;

  const trimmed = input.trim();
  if (trimmed === "") return undefined;

  try {
    return new Intl.Locale(trimmed).toString();
  } catch {
    return undefined;
  }
}

/**
 * Type guard: true if {@link input} is a BCP 47 tag the platform recognises as
 * a language. Well-formed but private-use tags ("xx", "zz") return false.
 */
export function isValidBcp47(
  input: string | null | undefined,
): input is Intl.UnicodeBCP47LocaleIdentifier {
  const tag = parseBcp47(input);
  if (tag === undefined) return false;

  try {
    // `fallback: "none"` makes `of()` return `undefined` for unknown tags
    // (private-use "xx"/"zz", or "en-XX"). Without it, the default `"code"`
    // fallback echoes the input verbatim, so `of("xx") === "xx"` would
    // falsely pass. See:
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DisplayNames/DisplayNames#fallback
    const names = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
    return names.of(tag) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Human-readable language name via Intl.DisplayNames.
 *
 * @param tag       A well-formed BCP 47 language tag.
 * @param inLocale  BCP 47 tag of the language to render the name in. Defaults
 *                  to {@link tag} so the language renders in its own script
 *                  ("Deutsch" for "de"). Pass the UI language to localise.
 * @returns The display name, or {@link tag} if the platform can't render one.
 */
export function displayBcp47(
  tag: Intl.UnicodeBCP47LocaleIdentifier,
  inLocale?: Intl.UnicodeBCP47LocaleIdentifier,
): string {
  try {
    const names = new Intl.DisplayNames(inLocale ?? tag, { type: "language" });
    const result = names.of(tag);
    return result ?? tag;
  } catch {
    return tag;
  }
}
