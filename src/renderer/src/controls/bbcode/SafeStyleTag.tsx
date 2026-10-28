import StyleTag from "./StyleTag";

/** The classes our own dialogs colour a warning or a success with. */
const ALLOWED_STYLES = new Set(["dialog-danger-text", "dialog-success-text"]);

/**
 * A style for bbcode we don't write ourselves. Its class is kept only if it is one of ours for
 * colouring text. Any other class is left off, as it could be any utility class there is, such as
 * one that covers the window.
 */
class SafeStyleTag extends StyleTag {
  protected className(style: string | undefined): string | undefined {
    return style !== undefined && ALLOWED_STYLES.has(style) ? style : undefined;
  }
}

export default SafeStyleTag;
