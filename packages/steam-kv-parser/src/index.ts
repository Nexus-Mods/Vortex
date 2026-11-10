/**
 * Parser for Steam's KeyValue (text VDF / ACF) format.
 *
 * https://developer.valvesoftware.com/wiki/KeyValues
 * https://github.com/ValveResourceFormat/ValveKeyValue
 */

/** A key with a plain string value. */
export type KVLeaf = {
  type: "leaf";
  key: string;
  value: string;
};

/** A key with nested children. */
export type KVBlock = {
  type: "block";
  key: string;
  children: KVNode[];
};

export type KVNode = KVLeaf | KVBlock;

/** Options for {@link parse}. */
export type KVParseOptions = {
  /**
   * Translate escape sequences (\\n, \\t, \\\\, \\\", ...) inside quoted values.
   * Off by default, matching KeyValues::UsesEscapeSequences: Steam emits
   * files with literal backslashes, so backslashes are kept verbatim.
   */
  escapes?: boolean;
};

/** Options for {@link stringify}. */
export type KVStringifyOptions = {
  /** Indent nested blocks with tabs. */
  pretty?: boolean;
  /**
   * Escape backslashes, quotes and control characters so that re-parsing
   * with `escapes: true` reproduces the original nodes.
   */
  escapes?: boolean;
};

/** A syntax error while parsing. Reports the 1-based line/column of the offending token. */
export class KVSyntaxError extends Error {
  line: number;
  column: number;

  constructor(message: string, line: number, column: number) {
    super(message);
    this.name = "KVSyntaxError";
    this.line = line;
    this.column = column;
  }
}

// State names kept bug-for-bug with ValveKeyValue, they appear in error messages.
type KVObjectState =
  | "InObjectBeforeKey"
  | "InObjectBetweenKeyAndValue"
  | "InObjectAfterAssignment"
  | "InObjectAfterValue";

type KVFrame = {
  name: string | null;
  state: KVObjectState;
};

const WHITESPACE = " \t\r\n";
const ESCAPES_OFF_HINT =
  ' A backslash-escaped quotation mark (\\") was read, but escape sequences are disabled - consider enabling the escapes option.';

const ESCAPE_TRANSLATIONS: Record<string, string> = {
  n: "\n",
  t: "\t",
  v: "\v",
  b: "\b",
  r: "\r",
  f: "\f",
  a: "\x07",
  "\\": "\\",
  "?": "?",
  "'": "'",
  '"': '"',
};

const IS_INCLUDE_DIRECTIVE = (value: string): boolean =>
  value.toLowerCase() === "#include" || value.toLowerCase() === "#base";

/**
 * Parse a text KeyValues document (VDF/ACF) into an ordered node tree.
 *
 * The returned block is the root object; its key is the document's root
 * key ("AppState" in an appmanifest, "libraryfolders" in libraryfolders.vdf).
 */
export function parse(text: string, options: KVParseOptions = {}): KVBlock {
  const escapesEnabled = options.escapes === true;
  // Set when a stray \" is seen in a quoted string while escapes are disabled;
  // every subsequent syntax error mentions it, like ValveKeyValue does.
  let sawUnescapedQuote = false;

  // Cursor over the source. A leading BOM is invisible.
  let index = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let column = 1;

  const advance = (): string | null => {
    const next = text[index];
    if (next === undefined) {
      return null;
    }
    index += 1;
    if (next === "\n") {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
    return next;
  };

  const peek = (): string | null => (index < text.length ? (text[index] ?? null) : null);
  const position = (): string => `line ${line}, column ${column}`;

  const fail = (message: string): KVSyntaxError =>
    new KVSyntaxError(sawUnescapedQuote ? message + ESCAPES_OFF_HINT : message, line, column);

  const frames: Array<KVFrame> = [{ name: null, state: "InObjectBeforeKey" }];
  const current = (): KVFrame => {
    const frame = frames[frames.length - 1];
    if (frame === undefined) {
      throw new Error("internal error: state stack underflow");
    }
    return frame;
  };
  const isAtDocumentLevel = (): boolean => frames.length === 1;

  // Mirrors ValveKeyValue's KVObjectBuilder: only real { blocks go on this stack.
  const objectStack: KVBlock[] = [];
  let root: KVBlock | null = null;
  // A scalar document root ("key" "value") is valid grammar but knee-deep in
  // Node.value; we cannot represent it, so its position is kept for the error.
  let scalarRoot: string | null = null;
  let scalarRootAt: string | null = null;

  const appendLeaf = (key: string, value: string): void => {
    const block = objectStack[objectStack.length - 1];
    if (block === undefined) {
      throw new Error("internal error: pair outside of any object");
    }
    block.children.push({ type: "leaf", key, value });
  };

  const skipTrivia = (): void => {
    for (;;) {
      const next = peek();
      if (next === null) {
        return;
      }
      if (WHITESPACE.includes(next)) {
        advance();
        continue;
      }
      // Tier1 bug compatibility: a lone slash is enough to start a comment.
      if (next === "/") {
        advance();
        if (peek() === "/") {
          advance();
        }
        while (peek() !== "\n" && peek() !== null) {
          advance();
        }
        continue;
      }
      return;
    }
  };

  const readQuoted = (tokenStart: string): string => {
    advance(); // opening quote
    let out = "";
    for (;;) {
      const next = peek();
      if (next === null) {
        throw fail(
          `Found end of file while trying to read the token that started at ${tokenStart}.`,
        );
      }
      if (escapesEnabled && next === "\\") {
        const escapeLine = line;
        const escapeColumn = column;
        advance();
        const escaped = peek();
        const translated = escaped === null ? undefined : ESCAPE_TRANSLATIONS[escaped];
        if (escaped === null || translated === undefined) {
          throw fail(
            `Unknown escape sequence '\\${escaped ?? ""}' at line ${escapeLine}, column ${escapeColumn}.`,
          );
        }
        advance();
        out += translated;
        continue;
      }
      if (next === '"') {
        advance();
        return out;
      }
      if (!escapesEnabled && next === "\\" && text[index + 1] === '"') {
        sawUnescapedQuote = true;
      }
      out += advance() ?? "";
    }
  };

  const readUnquoted = (): string => {
    let out = "";
    for (;;) {
      const next = peek();
      if (
        next === null ||
        WHITESPACE.includes(next) ||
        next === '"' ||
        next === "{" ||
        next === "}" ||
        next === "="
      ) {
        return out;
      }
      out += advance() ?? "";
    }
  };

  const finalizeCurrent = (explicit: boolean): void => {
    frames.pop();
    if (frames.length > 0) {
      const parent = frames[frames.length - 1];
      if (parent === undefined) {
        throw new Error("internal error: state stack underflow");
      }
      parent.state = "InObjectAfterValue";
    }
    if (!explicit) {
      return;
    }
    const completed = objectStack.pop();
    if (completed !== undefined) {
      const parent = objectStack[objectStack.length - 1];
      if (parent === undefined) {
        root = completed;
      } else {
        parent.children.push(completed);
      }
    }
  };

  const handleString = (tokenStart: string, value: string): void => {
    const frame = current();
    if (
      (frame.state === "InObjectBeforeKey" || frame.state === "InObjectAfterValue") &&
      isAtDocumentLevel() &&
      IS_INCLUDE_DIRECTIVE(value)
    ) {
      throw fail("KeyValues inclusions (#include, #base) are not supported.");
    }
    if (frame.state === "InObjectBeforeKey") {
      frame.name = value;
      frame.state = "InObjectBetweenKeyAndValue";
      return;
    }
    if (frame.state === "InObjectAfterValue") {
      if (isAtDocumentLevel()) {
        throw fail(
          `Found data after the root object at ${tokenStart}, documents with multiple root objects are not supported.`,
        );
      }
      // The previous pair is done, this string is the next key.
      finalizeCurrent(false);
      frames.push({ name: value, state: "InObjectBetweenKeyAndValue" });
      return;
    }
    // InObjectBetweenKeyAndValue / InObjectAfterAssignment: the string is a value.
    if (isAtDocumentLevel()) {
      scalarRoot = value;
      scalarRootAt = tokenStart;
      frame.state = "InObjectAfterValue";
      return;
    }
    if (frame.name === null) {
      throw new Error("internal error: pair without a name");
    }
    appendLeaf(frame.name, value);
    frame.state = "InObjectAfterValue";
  };

  const handleObjectStart = (tokenStart: string): void => {
    const frame = current();
    const { state, name } = frame;
    if (state !== "InObjectBetweenKeyAndValue" && state !== "InObjectAfterAssignment") {
      throw fail(`Attempted to begin new object while in state ${state} at ${tokenStart}.`);
    }
    objectStack.push({ type: "block", key: name ?? "", children: [] });
    frames.push({ name: null, state: "InObjectBeforeKey" });
  };

  const handleObjectEnd = (tokenStart: string): void => {
    const frame = current();
    if (isAtDocumentLevel() && frame.state === "InObjectAfterValue") {
      throw fail(
        `Found data after the root object at ${tokenStart}, documents with multiple root objects are not supported.`,
      );
    }
    if (frame.state !== "InObjectBeforeKey" && frame.state !== "InObjectAfterValue") {
      throw fail(`Attempted to finalize object while in state ${frame.state} at ${tokenStart}.`);
    }
    finalizeCurrent(true);
  };

  const handleAssignment = (tokenStart: string): void => {
    const frame = current();
    if (isAtDocumentLevel()) {
      throw fail(
        `Found '=' after the root key at ${tokenStart}, the root key must be followed by '{'.`,
      );
    }
    if (frame.state === "InObjectBetweenKeyAndValue") {
      frame.state = "InObjectAfterAssignment";
      return;
    }
    // Only the first '=' after a key is an assignment; anywhere else it is a string.
    handleString(tokenStart, "=");
  };

  const finalizeDocument = (): void => {
    const frame = current();
    if (
      !isAtDocumentLevel() ||
      (frame.state !== "InObjectBeforeKey" && frame.state !== "InObjectAfterValue")
    ) {
      throw fail(`Found end of file when another token type was expected at ${position()}.`);
    }
    finalizeCurrent(true);
  };

  for (;;) {
    skipTrivia();
    const next = peek();
    if (next === null) {
      finalizeDocument();
      break;
    }
    const tokenStart = position();
    switch (next) {
      case "{":
        advance();
        handleObjectStart(tokenStart);
        break;
      case "}":
        advance();
        handleObjectEnd(tokenStart);
        break;
      case "=":
        advance();
        handleAssignment(tokenStart);
        break;
      case '"':
        handleString(tokenStart, readQuoted(tokenStart));
        break;
      default:
        handleString(tokenStart, readUnquoted());
        break;
    }
  }

  if (root === null) {
    if (scalarRoot !== null) {
      throw fail(
        `Found value after the root key at ${scalarRootAt}, the root key must be followed by '{'.`,
      );
    }
    throw fail("The document does not contain a root object.");
  }
  return root;
}

const quoteValue = (value: string, escapes: boolean): string => {
  // A quotation mark would end the token early; a control character would
  // re-parse as something other than the explicit \\n or \\t it came from.
  if (!escapes && /["\n\r\t]/.test(value)) {
    throw new Error(
      `"${value}" requires escape sequences to be serialized - enable the escapes option.`,
    );
  }
  return escapes
    ? value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t")
    : value;
};

/**
 * Serialize a node tree back to text KeyValues.
 */
export function stringify(root: KVBlock, options: KVStringifyOptions = {}): string {
  const { pretty = false, escapes = false } = options;
  const parts: string[] = [];

  const emit = (depth: number, node: KVNode): void => {
    const head = `"${quoteValue(node.key, escapes)}"`;
    const indent = pretty ? "\t".repeat(depth) : "";
    if (node.type === "leaf") {
      parts.push(`${indent}${head}\t\t"${quoteValue(node.value, escapes)}"\n`);
      return;
    }
    if (pretty) {
      parts.push(`${indent}${head}\n${"\t".repeat(depth + 1)}{\n`);
      node.children.forEach((child) => emit(child.type === "leaf" ? depth + 2 : depth + 1, child));
      parts.push(`${"\t".repeat(depth + 1)}}\n`);
      return;
    }
    parts.push(`${head}{`);
    node.children.forEach((child) => emit(depth, child));
    parts.push("} ");
  };

  emit(0, root);
  return parts.join("");
}
