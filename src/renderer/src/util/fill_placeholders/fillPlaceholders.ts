/**
 * Fills in `{{ name }}` placeholders from `replace`, the way i18next does. Only
 * for when there's no translator yet: once i18n has loaded, `t` does this itself.
 * A placeholder with no value in `replace` is left as it is.
 */
export function fillPlaceholders(
  text: string,
  replace?: Record<string, string | number | boolean>,
): string {
  if (replace == null) {
    return text;
  }
  // `{{ name }}` or `{{ name, format }}`; the format is ignored.
  return text.replace(/\{\{\s*([^{},\s]+)\s*(?:,[^{}]*)?\}\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(replace, name) ? String(replace[name]) : placeholder,
  );
}
