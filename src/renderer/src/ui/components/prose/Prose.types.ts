/** What `Markdown`, `Html` and `PlainText` share, whatever their content's written in. */
export interface IProseProps {
  /** Its type size: the body text's, or smaller, as in a popover. Default `md`. */
  size?: "sm" | "md";
  /** Classes for its wrapper, e.g. to change its colour from the body text's. */
  className?: string;
}
