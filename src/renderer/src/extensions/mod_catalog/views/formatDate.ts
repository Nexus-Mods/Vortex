/** Short local date for an ISO timestamp from the API, or a dash when it's missing or invalid. */
export function formatDate(iso: string | undefined, language: string | undefined): string {
  if (iso === undefined) {
    return "–";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "–";
  }
  try {
    return date.toLocaleDateString(language);
  } catch {
    return date.toLocaleDateString();
  }
}
