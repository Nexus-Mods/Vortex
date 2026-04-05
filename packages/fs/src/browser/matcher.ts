import type { ResolvedPath } from "./paths";

/** @public */
export type Pattern = string;

/** @public */
export function matches(input: ResolvedPath, pattern: Pattern): boolean {
  if (pattern === "*") return true;

  let posInput = 0;
  let posPattern = 0;

  while (posPattern < pattern.length) {
    const indexStar = pattern.indexOf("*", posPattern);

    if (indexStar === -1) {
      const remaining = pattern.slice(posPattern);

      if (input.length - remaining.length < posInput) return false;
      return startsWith(
        input.slice(input.length - remaining.length),
        remaining,
      );
    }

    const part = pattern.slice(posPattern, indexStar);

    if (part.length > 0) {
      if (posPattern === 0) {
        if (!startsWith(input, part)) return false;
        posInput = part.length;
      } else {
        const idx = indexOf(input, part, posInput);
        if (idx === -1) return false;
        posInput = idx + part.length;
      }
    }

    posPattern = indexStar + 1;

    while (posPattern < pattern.length && pattern[posPattern] === "*")
      posPattern++;
  }

  return true;
}

const CHAR_SLASH = "/".charCodeAt(0);
const CHAR_BACKSLASH = "\\".charCodeAt(0);
const CHAR_UPPER_A = "A".charCodeAt(0);
const CHAR_UPPER_Z = "Z".charCodeAt(0);
const CHAR_CASE_OFFSET = "a".charCodeAt(0) - "A".charCodeAt(0);

function charCodeEqual(a: number, b: number): boolean {
  if (a === CHAR_BACKSLASH) a = CHAR_SLASH;
  if (b === CHAR_BACKSLASH) b = CHAR_SLASH;

  if (a >= CHAR_UPPER_A && a <= CHAR_UPPER_Z) a += CHAR_CASE_OFFSET;
  if (b >= CHAR_UPPER_A && b <= CHAR_UPPER_Z) b += CHAR_CASE_OFFSET;

  return a === b;
}

function startsWith(value: string, search: string): boolean {
  if (search.length > value.length) return false;

  for (let i = 0; i < search.length; i++) {
    const a = value.charCodeAt(i);
    const b = search.charCodeAt(i);
    if (!charCodeEqual(a, b)) return false;
  }

  return true;
}

function indexOf(input: string, part: string, offset: number): number {
  for (let i = offset; i <= input.length - part.length; i++) {
    let match = true;
    for (let j = 0; j < part.length; j++) {
      const a = input.charCodeAt(i + j);
      const b = part.charCodeAt(j);

      if (!charCodeEqual(a, b)) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}
