import { setImmediate as tick } from "node:timers/promises";
import zlib from "node:zlib";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSessionGot } from "./downloader";
import { type TestServer, createSharedTestServer, serveFile, withHooks } from "./test-server";

// The downloader holds received chunks until it writes a 1 MiB block, which is only safe while
// got (and the Node sockets, http parser and zlib beneath it) never reuse a chunk once yielded.

const BODY_BYTES = 8 * 1024 * 1024;
const SERVER_WRITE_BYTES = 16 * 1024;

// compressible, so zlib yields many slices per input chunk, yet every 1 KiB block is unique
function makeBody(): Buffer {
  const body = Buffer.alloc(BODY_BYTES);
  for (let block = 0; block < BODY_BYTES / 1024; block++) {
    const base = block * 1024;
    body.writeUInt32BE(block, base);
    for (let i = 4; i < 1024; i++) body[base + i] = (i * 31 + block) & 0xff;
  }
  return body;
}

const BODY = makeBody();

let server: TestServer;

beforeAll(async () => {
  server = await createSharedTestServer();
});

afterAll(() => server.close());

describe("got stream chunks", () => {
  it.each([
    { encoding: "identity", encode: (body: Buffer) => body },
    { encoding: "gzip", encode: (body: Buffer) => zlib.gzipSync(body) },
    { encoding: "deflate", encode: (body: Buffer) => zlib.deflateSync(body) },
    { encoding: "br", encode: (body: Buffer) => zlib.brotliCompressSync(body) },
  ])(
    "stay unchanged and unshared after they are yielded ($encoding)",
    async ({ encoding, encode }) => {
      using route = server.route(
        withHooks(
          serveFile({
            body: encode(BODY),
            headers: encoding === "identity" ? {} : { "content-encoding": encoding },
            chunkSize: SERVER_WRITE_BYTES,
          }),
          // a yield between writes makes each one a separate socket read
          { afterChunk: () => tick() },
        ),
      );

      const chunks: { ref: Buffer; snapshot: Buffer }[] = [];
      for await (const data of createSessionGot().stream(route.url)) {
        const chunk = data as Buffer;
        chunks.push({ ref: chunk, snapshot: Buffer.from(chunk) });
        // a slow consumer keeps the source reading while references are held
        if (chunks.length % 4 === 0) await tick();
      }

      expect(chunks.length, "expected the body to arrive in many chunks").toBeGreaterThan(32);

      chunks.forEach(({ ref, snapshot }, index) => {
        expect(ref.equals(snapshot), `chunk ${index} was mutated after being yielded`).toBe(true);
      });

      const rangesByBacking = new Map<ArrayBufferLike, [number, number][]>();
      for (const { ref } of chunks) {
        const ranges = rangesByBacking.get(ref.buffer) ?? [];
        ranges.push([ref.byteOffset, ref.byteOffset + ref.length]);
        rangesByBacking.set(ref.buffer, ranges);
      }
      for (const ranges of rangesByBacking.values()) {
        let previousEnd = 0;
        for (const [start, end] of ranges.sort((lhs, rhs) => lhs[0] - rhs[0])) {
          expect(start, "two chunks share overlapping memory").toBeGreaterThanOrEqual(previousEnd);
          previousEnd = end;
        }
      }

      const reassembled = Buffer.concat(chunks.map(({ ref }) => ref));
      expect(reassembled.equals(BODY), "reassembled body differs").toBe(true);
    },
  );
});
