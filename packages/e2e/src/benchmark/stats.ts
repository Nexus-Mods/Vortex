/**
 * Turns raw probe samples into the numbers the benchmark reports.
 */
import type { IProbeSample } from "./probe";

/** a frame gap above this is one the user sees as a stutter (three missed 60 Hz frames) */
export const JANK_FRAME_MS = 50;

export interface IResponsiveness {
  /** time until the page stopped changing, or the whole window when it never settled */
  settleMs: number;
  settled: boolean;
  /** worst input-to-next-paint time of any input event during the action */
  worstInputMs: number;
  /** summed duration of long tasks: time the main thread could not respond at all */
  longTaskMs: number;
  longTaskCount: number;
  /** summed blocking time of long animation frames */
  blockingMs: number;
  frameCount: number;
  frameP50Ms: number;
  frameP95Ms: number;
  worstFrameMs: number;
  jankFrames: number;
  /** when the page never settled, the elements that kept changing, busiest first */
  stillChanging?: string[];
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = values.toSorted((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank] ?? 0;
}

export function median(values: number[]): number {
  return percentile(values, 50);
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const max = (values: number[]) => values.reduce((top, value) => Math.max(top, value), 0);

export function summarize(sample: IProbeSample, settled: boolean): IResponsiveness {
  return {
    settleMs: settled ? sample.settledMs : sample.elapsedMs,
    settled,
    worstInputMs: max(sample.events.map((event) => event.duration)),
    longTaskMs: sum(sample.longTasks),
    longTaskCount: sample.longTasks.length,
    blockingMs: sum(sample.loafs.map((loaf) => loaf.blocking)),
    frameCount: sample.frames.length,
    frameP50Ms: percentile(sample.frames, 50),
    frameP95Ms: percentile(sample.frames, 95),
    worstFrameMs: max(sample.frames),
    jankFrames: sample.frames.filter((frame) => frame > JANK_FRAME_MS).length,
    ...(settled ? {} : { stillChanging: sample.busiest.map((b) => `${b.target} (${b.count})`) }),
  };
}
