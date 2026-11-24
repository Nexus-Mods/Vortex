/** What decides whether a pause is one to nudge the user back to their game at. */
interface IBreakNudgeOptions {
  /** How many mods have loaded, in full pages. */
  loaded: number;
  /** How many mods to nudge every, at the first pause at or past each multiple. */
  every: number;
  /** How many mods load between one pause and the next. */
  perPause: number;
}

/**
 * Whether this pause is the first at or past a multiple of `every`, so the nudge shows once per
 * multiple whatever it is, even one that falls between pauses.
 */
export const isBreakNudgePause = ({ loaded, every, perPause }: IBreakNudgeOptions) =>
  loaded >= every && Math.floor(loaded / every) > Math.floor((loaded - perPause) / every);
