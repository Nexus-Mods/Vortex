/** What `Markdown`, `Html` and `PlainText` share, whatever their content's written in. */
export interface IProseProps {
  /** Its type size: the body text's, or smaller, as in a popover. Default `md`. */
  size?: "sm" | "md";
  /** Classes for its wrapper, e.g. to change its colour from the body text's. */
  className?: string;
}

/** What the prose that can show images shares: `Markdown`, `Html` and `BBCode`. */
export interface IProseWithImagesProps extends IProseProps {
  /** Whether what it's from, such as a mod, is adult content; blurs its images if the user's set to. */
  isFromAdultContent?: boolean;
}
