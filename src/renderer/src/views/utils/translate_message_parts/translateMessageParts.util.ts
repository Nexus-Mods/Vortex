/**
 * Translates a message one piece at a time. A caller builds a message from translation keys and
 * plain values, separated by tabs within a line and by line breaks between lines, so the whole
 * text is not a key. Each tab-separated part is translated on its own, then the parts of a line
 * are joined with a space and the lines with a line break. Does what the legacy dialog does for
 * its message.
 */
export const translateMessageParts = (message: string, translate: (part: string) => string) =>
  message
    .split("\n")
    .map((line) => line.split("\t").map(translate).join(" "))
    .join("\n");
