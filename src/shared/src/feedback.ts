/**
 * How far back a feedback's logs can go, in minutes: the stops of the dialog's slider. Ten minutes
 * and half an hour, then every whole hour up to twelve.
 */
export const LOG_WINDOW_MINUTES = [
  10, 30, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720,
] as const;

export type LogWindowMinutes = (typeof LOG_WINDOW_MINUTES)[number];

/** How far back the logs go unless the user chooses otherwise. */
export const DEFAULT_LOG_WINDOW_MINUTES: LogWindowMinutes = 60;

/** The text field's limit, which the form enforces and the payload contract states. */
export const MAX_FEEDBACK_TEXT_LENGTH = 4000;

const LOG_FILE_RE = /^vortex\d?\.log$/;

/**
 * The files winston writes next to the state, which a support bundle and a feedback carry.
 * `startup.log` is deliberately out: it's written by the main process before logging is
 * configured and holds nothing we can't get elsewhere.
 */
export function isBundledLogFile(name: string): boolean {
  return LOG_FILE_RE.test(name) || name === "network.log";
}

/** How far back a feedback's window recording goes, at least. */
export const REPLAY_WINDOW_MS: number = 5 * 60_000;

/**
 * How often the recorder starts again from a full picture of the page. Main keeps the recording
 * as the segments between them, so dropping the oldest segment never leaves the rest unplayable.
 */
export const REPLAY_CHECKOUT_MS = 150_000;
