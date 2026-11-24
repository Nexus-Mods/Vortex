/** A `[code]` tag, or `[code=…]`, with any line breaks written around it. */
const CODE_WITH_BREAKS =
  /(\s*\[br\]\[\/br\])?(?:\s*\[br\]\[\/br\])*\s*\[code(?:=([^\]]*))?\]([\s\S]*?)\[\/code\]((?:\s*\[br\]\[\/br\])+)?/gi;

/** Blank lines at the start, up to the first line's indent, which a block doesn't show. */
const LEADING_BLANK_LINES = /^(?:[ \t]*(?:\[br\]\[\/br\]\r?\n?|\r?\n))+/;

/** Line breaks or blank space at either end. */
const OUTER_BLANKS = /^(?:\s|\[br\]\[\/br\])+|(?:\s|\[br\]\[\/br\])+$/g;

/** Line breaks or blank space at the end. */
const TRAILING_BLANKS = /(?:\s|\[br\]\[\/br\])+$/;

/** A line break, as `preProcess` writes `<br>`. */
const LINE_BREAK = /\[br\]\[\/br\]/;

/** Bbcode's text, without its tags. */
const textOf = (bbcode: string) => bbcode.replace(/\[[^\]]*\]/g, "").trim();

/**
 * Stands in for `[` inside code, so the parser reads no tags there; `CodeTag` puts it back. From
 * Unicode's private use area, which no description should write.
 */
export const CODE_BRACKET = "";

/** Code's text, with its `[`s hidden from the parser. */
const hideTags = (code: string) => code.replace(/\[/g, CODE_BRACKET);

/** A `[code]` tag as `codeAsWritten` rewrites it, given where it is in the bbcode. */
const codeTag = (
  tag: string,
  breakBefore: string | undefined,
  param: string | undefined,
  content: string,
  breakAfter: string | undefined,
  offset: number,
  input: string,
) => {
  const before = input.slice(0, offset).split(LINE_BREAK).pop() ?? "";
  const after = textOf(input.slice(offset + tag.length).split(LINE_BREAK)[0]);
  const startsLine = !!breakBefore || !textOf(before);
  const endsSentence = !breakAfter && /^\p{P}+$/u.test(after);
  const isOneLine =
    !LINE_BREAK.test(content.replace(OUTER_BLANKS, "")) && !content.trim().includes("\n");
  const isInline = param === "inline" || (isOneLine && (!startsLine || endsSentence));

  if (isInline) {
    const spaceBefore = /^\s/.test(content) ? " " : "";
    const spaceAfter = /\s$/.test(content) ? " " : "";
    return tag.replace(
      /\[code(?:=[^\]]*)?\][\s\S]*\[\/code\]/i,
      () =>
        `${spaceBefore}[code=inline]${hideTags(content.replace(OUTER_BLANKS, ""))}[/code]${spaceAfter}`,
    );
  }

  const lines = content
    .replace(LEADING_BLANK_LINES, "")
    .replace(TRAILING_BLANKS, "")
    .replace(/\r?\n?\[br\]\[\/br\]\r?\n?/g, "\n");

  return `[code]${hideTags(lines)}[/code]`;
};

/**
 * Bbcode with each `[code]` as it reads. Within a line of text it's inline code, so it stays in its
 * sentence, any space at its ends moved outside it to keep it apart from its words; so is code
 * starting a line that only punctuation follows. Any other is a block, one line to a line break,
 * without the line breaks around it, which its own margins stand in for. The parser reads no tags
 * inside code. Takes bbcode whose `<br>`s are already `[br][/br]`.
 */
export const codeAsWritten = (bbcode: string) => bbcode.replace(CODE_WITH_BREAKS, codeTag);
