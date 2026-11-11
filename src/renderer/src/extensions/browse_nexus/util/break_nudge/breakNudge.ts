/** What decides whether a pause is the one to nudge the user back to their game at. */
interface IBreakNudgeOptions {
  /** How many mods have loaded, in full pages. */
  loaded: number;
  /** How many mods to nudge at, the first pause at or past it. */
  threshold: number;
  /** How many mods load between one pause and the next. */
  perPause: number;
}

/**
 * Whether this pause is the first at or past `threshold`, so the nudge shows once whatever the
 * threshold, even one that falls between pauses.
 */
export const isBreakNudgePause = ({ loaded, threshold, perPause }: IBreakNudgeOptions) =>
  loaded >= threshold && loaded - perPause < threshold;
