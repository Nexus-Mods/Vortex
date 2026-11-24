import { once } from "node:events";
import { promisify } from "node:util";
import { createGzip, gunzip } from "node:zlib";

import type { ReplaySegment } from "./replay";

const gunzipAsync = promisify(gunzip);

/**
 * A screen recording as it is sent: its events as one JSON array, gzip-compressed and base64
 * encoded, with what the service's views read without decoding it.
 */
export interface IPackedReplay {
  /** base64 of the gzip-compressed JSON array of events, as one gzip stream */
  data: string;
  startsAt: string;
  endsAt: string;
  eventCount: number;
}

/**
 * Packs a recording to send. The renderer handed it over masked, redacted and compressed, each
 * segment's chunks making up its events separated by commas. The chunks are separate gzip streams,
 * which the browser's `DecompressionStream`, as the feedback views read a recording with, can't
 * read one after another, so they are decompressed one at a time and written out again as one
 * stream. zlib does both on its own threads, so main's event loop is never held up for long.
 */
export async function packReplay(
  segments: readonly ReplaySegment[],
): Promise<IPackedReplay | undefined> {
  const kept = segments.filter((segment) => segment.length > 0);
  const chunks = kept.flat();
  const first = chunks[0];
  const last = chunks.at(-1);
  if (first === undefined || last === undefined) return undefined;

  const gzip = createGzip();
  const output: Buffer[] = [];
  gzip.on("data", (data: Buffer) => output.push(data));
  const finished = once(gzip, "end");
  const write = async (data: string | Buffer): Promise<void> => {
    if (!gzip.write(data)) await once(gzip, "drain");
  };

  await write("[");
  for (const [index, segment] of kept.entries()) {
    if (index > 0) await write(",");
    for (const chunk of segment) {
      await write(await gunzipAsync(chunk.data));
    }
  }
  gzip.end("]");
  await finished;

  return {
    data: Buffer.concat(output).toString("base64"),
    startsAt: new Date(first.startsAt).toISOString(),
    endsAt: new Date(last.endsAt).toISOString(),
    eventCount: chunks.reduce((count, chunk) => count + chunk.eventCount, 0),
  };
}
