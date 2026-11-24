/**
 * The window recording a feedback can carry, kept in main. The renderer records, masks and
 * redacts it, and hands it over as text a few seconds at a time; main compresses each batch on
 * zlib's own threads, so neither the window nor main's event loop does that work, keeps the last
 * few minutes compressed, and puts them aside as the feedback dialog opens, so the recording ends
 * where the user stopped to write. A chunk is opened again only when a feedback carrying the
 * recording is sent (`packReplay`).
 */
import { promisify } from "node:util";
import { gzip } from "node:zlib";

import { getErrorMessageOrDefault, REPLAY_CHECKOUT_MS, REPLAY_WINDOW_MS } from "@vortex/shared";
import type { IFeedbackReplayBatch, IFeedbackReplayInfo } from "@vortex/shared/ipc";

import { log } from "../logging";

const gzipAsync = promisify(gzip);

/** Segments kept: enough that the oldest one starts at least the window back. */
const KEPT_SEGMENTS = Math.ceil(REPLAY_WINDOW_MS / REPLAY_CHECKOUT_MS) + 1;

/**
 * A bound on memory for a page that changes without pause, such as a long download list. The
 * chunks are compressed, so this holds a great deal more recording than its size suggests.
 */
const MAX_BYTES = 32 * 1024 * 1024;

/** A batch as main keeps it: its text as one complete gzip stream. */
export interface IReplayChunk {
  data: Uint8Array;
  startsSegment: boolean;
  startsAt: number;
  endsAt: number;
  eventCount: number;
}

/** A segment: the chunks from one full picture of the page up to the next. */
export type ReplaySegment = readonly IReplayChunk[];

/** The kept recording, as segments that each start from a full picture of the page. */
export class ReplayBuffer {
  #segments: IReplayChunk[][] = [];
  #bytes = 0;

  public add(chunk: IReplayChunk): void {
    if (chunk.startsSegment) {
      this.#segments.push([]);
    }
    const current = this.#segments.at(-1);
    // the rest of a segment main never saw the start of: without its full picture of the page
    // it can't be played back
    if (current === undefined) return;
    current.push(chunk);
    this.#bytes += chunk.data.byteLength;
    while (
      this.#segments.length > 1 &&
      (this.#segments.length > KEPT_SEGMENTS || this.#bytes > MAX_BYTES)
    ) {
      for (const dropped of this.#segments.shift() ?? []) {
        this.#bytes -= dropped.data.byteLength;
      }
    }
  }

  /**
   * The recording up to `now`: the newest segments that reach the window back, and no older ones.
   */
  public take(now: number): ReplaySegment[] {
    const from = now - REPLAY_WINDOW_MS;
    let first = 0;
    // a segment can go when the one after it already starts inside the window
    while (first + 1 < this.#segments.length && this.#segments[first + 1]![0]!.startsAt <= from) {
      first += 1;
    }
    // copies of the lists, so chunks added later don't join what was taken
    return this.#segments.slice(first).map((segment) => [...segment]);
  }
}

/** What is known of a recording without opening it. */
export function replayInfo(segments: readonly ReplaySegment[]): IFeedbackReplayInfo | null {
  const chunks = segments.flat();
  const first = chunks[0];
  const last = chunks.at(-1);
  if (first === undefined || last === undefined) return null;
  return {
    startsAt: first.startsAt,
    endsAt: last.endsAt,
    eventCount: chunks.reduce((count, chunk) => count + chunk.eventCount, 0),
  };
}

let buffer = new ReplayBuffer();

/** The recording put aside for the dialog that is open, if any. */
let frozen: ReplaySegment[] | undefined;

/**
 * The batches being compressed, in the order they came: each joins the buffer once every batch
 * before it has, however long its own compression takes.
 */
let compressing: Promise<void> = Promise.resolve();

/** Counts recordings, so a batch still being compressed when recording stops is dropped. */
let generation = 0;

/** Compresses a batch the renderer handed over, and keeps it. Resolves once it is kept. */
export function addReplayBatch(batch: IFeedbackReplayBatch): Promise<void> {
  const takenIn = generation;
  // compressing starts now, alongside the batches before it, rather than waiting its turn
  const compressed = gzipAsync(batch.text);
  // handled from the start, so a failure while an earlier batch is still compressing is not
  // reported as unhandled; awaiting it below still throws, and logs it
  compressed.catch(() => undefined);
  const before = compressing;
  compressing = (async () => {
    // never rejects: a failure is logged below, so one bad batch doesn't stop the ones after it
    await before;
    try {
      const data = await compressed;
      if (takenIn !== generation) return;
      buffer.add({
        data,
        startsSegment: batch.startsSegment,
        startsAt: batch.startsAt,
        endsAt: batch.endsAt,
        eventCount: batch.eventCount,
      });
    } catch (err) {
      log("warn", "failed to keep a piece of the window recording", {
        error: getErrorMessageOrDefault(err),
      });
    }
  })();
  return compressing;
}

/** Forgets the recording, once the user may no longer be recorded. */
export function resetReplay(): void {
  generation += 1;
  buffer = new ReplayBuffer();
  frozen = undefined;
}

/**
 * Puts the last few minutes aside for the feedback dialog being opened, in place of whatever an
 * earlier dialog had, once the batches handed over before it are kept. The chunks are kept by
 * reference: none is changed once kept.
 */
export async function freezeReplay(now: number = Date.now()): Promise<IFeedbackReplayInfo | null> {
  await compressing;
  const segments = buffer.take(now);
  const info = replayInfo(segments);
  frozen = info === null ? undefined : segments;
  return info;
}

/** The recording put aside as the dialog opened. */
export function frozenReplay(): readonly ReplaySegment[] | undefined {
  return frozen;
}

/**
 * Lets go of the recording put aside for a dialog that has closed. It can run to megabytes, and
 * the buffer may already have dropped it.
 */
export function releaseReplay(): void {
  frozen = undefined;
}
