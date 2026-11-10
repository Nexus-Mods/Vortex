// Characters no file system we install to takes in a name, or that would make it a path.
// eslint-disable-next-line no-control-regex
const INVALID_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f]/;

/**
 * A name for a new folder that no sibling has: `base`, or `base 2`, `base 3` and so on if it's
 * taken. Names match without regard to case.
 */
export function uniqueFolderName(base: string, taken: Iterable<string>): string {
  const lowered = new Set([...taken].map((name) => name.toLowerCase()));

  let name = base;

  for (let count = 2; lowered.has(name.toLowerCase()); count++) {
    name = `${base} ${count}`;
  }

  return name;
}

/**
 * Whether `name`, trimmed, can name a new folder: it has something in it, is no path, and
 * isn't `.` or `..`, ends in no dot as Windows takes none, and no sibling has it. Names match
 * without regard to case.
 */
export function isValidFolderName(name: string, taken: Iterable<string>): boolean {
  const trimmed = name.trim();

  if (
    trimmed === "" ||
    trimmed === "." ||
    trimmed === ".." ||
    trimmed.endsWith(".") ||
    INVALID_CHARACTERS.test(trimmed)
  ) {
    return false;
  }

  return ![...taken].some((other) => other.toLowerCase() === trimmed.toLowerCase());
}
