/**
 * Minimal glob matcher for the installer stop-pattern resolver.
 *
 * Supported syntax:
 * - double-star matches any sequence of characters including slash
 * - single-star matches any characters except slash
 * - question mark matches any single non-slash character
 * - brace alternation: `{a,b,c}` matches any listed alternative
 *
 * A leading `**<slash>` on a pattern marks it as wrapper-tolerant: the
 * pattern can match any file path whose suffix matches the remainder
 * (the "stable" portion). The stable suffix is captured so the
 * resolver can derive a destination.
 *
 * Matching is case-insensitive, aligning with Windows filesystem
 * semantics and how classic Vortex stop patterns behave.
 */

/**
 * Compiled glob. The capture group inside the regex is the portion of
 * the file path that corresponds to the stable (non-wrapper) part of
 * the pattern; resolvers use it as the implicit destination.
 */
export interface CompiledGlob {
  readonly regex: RegExp;
  readonly hasWrapper: boolean;
}

/**
 * Compiles a glob pattern. A leading wrapper segment is treated as
 * optional; the remainder becomes the captured stable portion.
 *
 * Throws an Error when the pattern has an unterminated brace.
 */
export function compileGlob(pattern: string): CompiledGlob {
  const hasWrapper = pattern.startsWith("**/");
  const stable = hasWrapper ? pattern.slice(3) : pattern;
  const stableRx = globBodyToRegex(stable);
  const full = hasWrapper ? `^(?:.*/)?(${stableRx})$` : `^(${stableRx})$`;
  return { regex: new RegExp(full, "i"), hasWrapper };
}

/**
 * Runs compileGlob against a file and returns the captured stable
 * portion, or null if the pattern does not match.
 */
export function matchGlob(pattern: string, file: string): string | null {
  const { regex } = compileGlob(pattern);
  const m = regex.exec(file);
  return m ? (m[1] ?? file) : null;
}

/**
 * Translates the body of a glob pattern into a regex fragment. Called
 * recursively for alternation branches. Does not wrap the result in
 * anchors and does not add the capture group.
 */
function globBodyToRegex(glob: string): string {
  let out = "";
  let i = 0;
  while (i < glob.length) {
    // Triple-character tokens first: wrapper-start and wrapper-end.
    if (glob.startsWith("**/", i)) {
      out += "(?:.*/)?";
      i += 3;
      continue;
    }
    if (
      glob.startsWith("/**", i) &&
      (i + 3 === glob.length || glob[i + 3] === "/")
    ) {
      out += "(?:/.*)?";
      i += 3;
      continue;
    }
    if (glob.startsWith("**", i)) {
      out += ".*";
      i += 2;
      continue;
    }

    const c = glob[i];
    if (c === "*") {
      out += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      out += "[^/]";
      i += 1;
      continue;
    }
    if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end === -1) {
        throw new Error(`Unterminated brace in glob pattern: "${glob}"`);
      }
      const alts = glob.slice(i + 1, end).split(",");
      out += `(?:${alts.map(globBodyToRegex).join("|")})`;
      i = end + 1;
      continue;
    }
    // Regex metacharacters that appear literally in glob text.
    if (c !== undefined && ".+|()[]^$\\".includes(c)) {
      out += `\\${c}`;
      i += 1;
      continue;
    }

    out += c ?? "";
    i += 1;
  }
  return out;
}
