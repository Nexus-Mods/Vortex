/** Windows and POSIX disagree about separators and case; matches either way. */
export const normPath = (value: string): string =>
  value
    .replace(/[/\\]+/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();
