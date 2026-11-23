/** A `[code]` tag, with any line breaks written around it. */
const CODE_WITH_BREAKS =
  /(\s*\[br\]\[\/br\])?(?:\s*\[br\]\[\/br\])*\s*\[code\]([\s\S]*?)\[\/code\]((?:\s*\[br\]\[\/br\])+)?/gi;

/** Line breaks or blank space at either end, which code doesn't show. */
const OUTER_BLANKS = /^(?:\s|\[br\]\[\/br\])+|(?:\s|\[br\]\[\/br\])+$/g;

/** A line break, as `preProcess` writes `<br>`. */
const LINE_BREAK = /\[br\]\[\/br\]/;

/** Whether bbcode has no text, only tags such as `[i]` or `[*]`. */
const hasNoText = (bbcode: string) => !bbcode.replace(/\[[^\]]*\]/g, "").trim();

/** A `[code]` tag as `codeAsWritten` rewrites it, given where it is in the bbcode. */
const codeTag = (
  tag: string,
  breakBefore: string | undefined,
  content: string,
  breakAfter: string | undefined,
  offset: number,
  input: string,
) => {
  const code = content.replace(OUTER_BLANKS, "");
  const before = input.slice(0, offset).split(LINE_BREAK).pop() ?? "";
  const after = input.slice(offset + tag.length).split(LINE_BREAK)[0];
  const isAlone = (!!breakBefore || hasNoText(before)) && (!!breakAfter || hasNoText(after));

  if (!isAlone && !LINE_BREAK.test(code) && !code.includes("\n")) {
    const spaceBefore = /^\s/.test(content) ? " " : "";
    const spaceAfter = /\s$/.test(content) ? " " : "";
    return tag.replace(
      /\[code\][\s\S]*\[\/code\]/i,
      () => `${spaceBefore}[code=inline]${code}[/code]${spaceAfter}`,
    );
  }

  return `[code]${code.replace(/\r?\n?\[br\]\[\/br\]\r?\n?/g, "\n")}[/code]`;
};

/**
 * Bbcode with each `[code]` as it reads: within a line of text it's inline code, so it stays in its
 * sentence, any space at its ends moved outside it to keep it apart from its words. Any other is a block, one line to a line break, without the line breaks around it, which
 * its own margins stand in for. Takes bbcode whose `<br>`s are already `[br][/br]`.
 */
export const codeAsWritten = (bbcode: string) => bbcode.replace(CODE_WITH_BREAKS, codeTag);
