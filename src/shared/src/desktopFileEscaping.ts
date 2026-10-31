/**
 * Escape a value for desktop-entry fields that use the `string` type.
 *
 * Note(sewer)
 * For other fields 'string' and 'localestring':
 * The escape sequences \s, \n, \t, \r, and \\ are supported for values of
 * type string and localestring, meaning ASCII space, newline, tab, carriage
 * return, and backslash, respectively.
 *
 * Note that 'Exec' is a string.
 * ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/OS/LinuxInterop.Protocol.cs#L235-L251
 * spec: https://specifications.freedesktop.org/desktop-entry-spec/latest/value-types.html
 */
export function escapeDesktopFilePath(input: string): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/ /g, "\\s")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r");
}

/**
 * Escape a single argument value for desktop-entry `Exec=`.
 *
 * Note(sewer)
 * For the exec field. Quoted relevant parts below.
 * https://specifications.freedesktop.org/desktop-entry-spec/latest/exec-variables.html
 *
 * "Arguments may be quoted in whole. If an argument contains a reserved
 *  character the argument must be quoted. The rules for quoting of arguments
 *  is also applicable to the executable name or path of the executable
 *  program as provided."
 *
 * "Quoting must be done by enclosing the argument between double quotes and
 *  escaping the double quote character, backtick character (`), dollar sign ($)
 *  and backslash character (\) by preceding it with an additional backslash
 *  character."
 *
 * If escaping changes the input, the argument is wrapped in quotes.
 *
 * ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/src/NexusMods.Backend/OS/LinuxInterop.Protocol.cs#L164-L233
 * spec: https://specifications.freedesktop.org/desktop-entry-spec/latest/exec-variables.html
 */
export function escapeDesktopExecFilePath(input: string): string {
  const originalPath = input;

  // Note(sewer)
  //
  // Spec says"
  //
  // > Note that the general escape rule for values of type string states that
  // > the backslash character can be escaped as ("\\") as well and that this
  // > escape rule is applied before the quoting rule
  //
  // BUT it wasn't clear if this was for decoding or encoding.
  // Turns out it's for decoding.
  //
  // You can verify this by putting the App in a folder with a space in it.
  // The correct output is '\s', not '\\s'. Former works, latter does not.
  const escapedExec = input
    .replace(/\\/g, "\\\\") // and backslash character ("\")             \ -> \\
    .replace(/"/g, '\\"') // 'and escaping the double quote character'   " -> \"
    .replace(/`/g, "\\`") // backtick character ("`")                    ` -> \`
    .replace(/\$/g, "\\$"); // dollar sign ("$")                         $ -> \$

  // First apply the base rules from `string` and `localstring`.
  const escapedString = escapeDesktopFilePath(escapedExec);

  // Note(sewer): Quoting the spec
  //
  // > Note that the general escape rule for values of type string states that
  //   the backslash character can be escaped as ("\\") as well and that this
  //   escape rule is applied before the quoting rule. As such, to unambiguously
  //   represent a literal backslash character in a quoted argument in a desktop
  //   entry file requires the use of four successive backslash characters ("\\\\").
  //
  // So escaping `\` twice, leading to 4 backslashes as a result of applying
  // both functions is by design, even if it may 'feel weird'.
  //
  // > Likewise, a literal dollar sign in a quoted argument in a desktop
  //   entry file is unambiguously represented with ("\\$").
  //
  // So we go from `$` to `\$`.
  // And then from `\$` to `\\$`.
  //
  // As per the example in the spec, this is not a bug, this is intended behaviour, even if weird.

  // Note(sewer):
  //
  // The docs say:
  // > Arguments may be quoted in whole. If an argument contains a reserved
  // > character the argument must be quoted.
  //
  // > Reserved characters are space (" "), tab, newline, double quote,
  // > single quote ("'"), backslash character ("\\"), greater-than sign (">"),
  // > less-than sign ("<"), tilde ("~"), vertical bar ("|"), ampersand ("&"),
  // > semicolon (";"), dollar sign ("$"), asterisk ("*"), question mark ("?"),
  // > hash mark ("#"), parenthesis ("(") and (")") and backtick character ("`").
  //
  // In this case, we will quote if our path has changed, else we'll leave it unquoted.
  if (escapedString === originalPath) {
    return originalPath; // No need to quote if the path hasn't changed
  } else {
    return `"${escapedString}"`; // Enclose the entire path in double quotes
  }
}
