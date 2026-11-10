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

/** Why a name can't be a folder's: see `folderNameProblem`. */
export type FolderNameProblem = "empty" | "dot" | "trailingDot" | "invalidCharacter" | "taken";

/**
 * What is wrong with `name`, trimmed, as the name of a new folder, or `undefined` if it works. It
 * works if it has something in it, is no path, isn't `.` or `..`, ends in no dot as Windows takes
 * none, and no sibling has it. Names match without regard to case. If several things are wrong,
 * the first of these is the one reported.
 */
export function folderNameProblem(
  name: string,
  taken: Iterable<string>,
): FolderNameProblem | undefined {
  const trimmed = name.trim();

  if (trimmed === "") {
    return "empty";
  }
  if (trimmed === "." || trimmed === "..") {
    return "dot";
  }
  if (INVALID_CHARACTERS.test(trimmed)) {
    return "invalidCharacter";
  }
  if (trimmed.endsWith(".")) {
    return "trailingDot";
  }
  if ([...taken].some((other) => other.toLowerCase() === trimmed.toLowerCase())) {
    return "taken";
  }

  return undefined;
}
