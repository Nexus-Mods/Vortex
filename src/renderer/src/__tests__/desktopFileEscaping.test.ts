import {
  escapeDesktopExecFilePath,
  escapeDesktopFilePath,
} from "../util/protocolRegistration/linux/desktopFileEscaping";

// Note(sewer)
// Source (ported from code I wrote in NMA originally):
// ref: https://github.com/Nexus-Mods/NexusMods.App/blob/main/tests/NexusMods.CrossPlatform.Tests/ProtocolRegistrationLinuxTests.cs#L10-L147

describe("desktopFileEscaping", () => {
  // Source: https://specifications.freedesktop.org/desktop-entry-spec/latest-single/#value-types
  describe("escapeDesktopFilePath", () => {
    test.each([
      ["Text with spaces", "Text\\swith\\sspaces"], // \s
      ["Text\nwith\nnewlines", "Text\\nwith\\nnewlines"], // \n
      ["Text\twith\ttabs", "Text\\twith\\ttabs"], // \t
      ["Text\rwith\rcarriage returns", "Text\\rwith\\rcarriage\\sreturns"], // \r
      [
        "Mixed\nchars with\tspecial\rvalues and spaces",
        "Mixed\\nchars\\swith\\tspecial\\rvalues\\sand\\sspaces",
      ],
      ["Pathwith\\backslash", "Pathwith\\\\backslash"], // \

      // Note: The `string` type is only meant to be ASCII in the spec, so
      //       a path with UTF-8 characters is 'technically' invalid. However,
      //       file paths allow arbitrary byte sequences (including UTF-8, by definition)
      //       and fields of type `string` such as `TryExec` in the `.desktop` spec
      //       are used to refer to file locations.
      //
      //       I have verified, at least against KDE and GNOME, in practice that
      //       leaving UTF-8 in file paths (`TryExec`) is the correct behaviour here.
      ["UTF-8 characters: ñáéíóú", "UTF-8\\scharacters:\\sñáéíóú"],

      // Note: The method doesn't currently escape semicolons as none of the fields
      //       we use support multiple values, delimited by semicolons.
    ])("escapes %j to %j", (input: string, expected: string) => {
      expect(escapeDesktopFilePath(input)).toBe(expected);
    });
  });

  // https://specifications.freedesktop.org/desktop-entry-spec/latest-single/#exec-variables
  describe("escapeDesktopExecFilePath", () => {
    // 👇 Characters that are escaped ONLY by the rules specific to 'Exec' 👇 //
    test.each([
      ['"', '"\\\\""'],
      //    "          (original)
      // -> \"         ('Exec' escape)
      // -> \\"        ('string' escape, \ -> \\ )
      // -> "\\""      (added double quotes)
      ["`", '"\\\\`"'],
      //    `          (original)
      // -> \`         ('Exec' escape)
      // -> \\`        ('string' escape, \ -> \\ )
      // -> "\\`"      (added double quotes)

      ["$", '"\\\\$"'],
      //    $          (original)
      // -> \$         ('Exec' escape)
      // -> \\\$       ('string' escape, \ -> \\ )
      // -> "\\$"      (added double quotes)
      // Note: $ -> \\$ is an example from the spec itself.

      // 👇 Characters that are escaped in rules for both 'Exec' and 'string' 👇 //
      ["\\", '"\\\\\\\\"'],
      //    \         (original)
      // -> \\        ('Exec' escape)
      // -> \\\\      (string escape, \ -> \\ ) , we have two backslashes, each one escaped, doubling the count
      // -> "\\\\"    (added double quotes)

      // 👇 Characters that are escaped in rules for 'string' only 👇 //
      [" ", '"\\s"'],
      //    [space]     (original)
      // -> [space]     ('Exec' escape, no change)
      // -> \s          (string escape, [space] -> \s )
      // -> "\s"        (added double quotes)
      ["\n", '"\\n"'],
      //    [newline]   (original)
      // -> [newline]   ('Exec' escape, no change)
      // -> \n          (string escape, [newline] -> \n )
      // -> "\n"        (added double quotes)
      ["\t", '"\\t"'],
      //    [tab]       (original)
      // -> [tab]       ('Exec' escape, no change)
      // -> \t          (string escape, [tab] -> \t )
      // -> "\t"        (added double quotes)
      ["\r", '"\\r"'],
      //    [carriage return]   (original)
      // -> [carriage return]   ('Exec' escape, no change)
      // -> \r                  (string escape, [carriage return] -> \r )
      // -> "\r"                (added double quotes)

      ["thispathdoesnotneedescapequotes", "thispathdoesnotneedescapequotes"],
      // no " wrapping, because the string has not changed.
    ])("escapes %j to %j", (input: string, expected: string) => {
      expect(escapeDesktopExecFilePath(input)).toBe(expected);
    });

    // % is not tested because spec says:
    //
    // > Field codes must not be used inside a quoted argument, the result of
    // > field code expansion inside a quoted argument is undefined
    //
    // All of the arguments we generate are quoted, so % does not need escaping.
  });
});
