import { randomBytes } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect } from "vitest";

import {
  Downloader,
  type DownloaderOptions,
  defaultOptions,
} from "./downloader";
import {
  type TestServer,
  type RequestHandler,
  withTestServer,
  serveFile,
} from "./test-server";

const LARGE_FILE = randomBytes(20 * 1024 * 1024);
const SMALL_FILE = randomBytes(1024);

async function withTmpDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "downloader-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function makeDownloader(
  overrides: Partial<DownloaderOptions> = {},
): Downloader {
  return new Downloader({ ...defaultOptions(), ...overrides });
}

async function download(
  server: TestServer,
  destDir: string,
  downloader = makeDownloader(),
  filename = "output",
): Promise<Buffer> {
  const dest = path.join(destDir, filename);
  await downloader.download(server.url, dest);
  return readFile(dest);
}

describe("Downloader", () => {
  it("produces a byte-perfect file for a small file without range support", async () => {
    await withTestServer(
      serveFile({ body: SMALL_FILE, acceptRanges: false }),
      async (server) => {
        await withTmpDir(async (dir) => {
          const result = await download(server, dir);
          expect(Buffer.compare(SMALL_FILE, result)).toBe(0);
        });
      },
    );
  });

  it("produces a byte-perfect file for a small file with range support", async () => {
    await withTestServer(
      serveFile({ body: SMALL_FILE, acceptRanges: true }),
      async (server) => {
        await withTmpDir(async (dir) => {
          const result = await download(server, dir);
          expect(Buffer.compare(SMALL_FILE, result)).toBe(0);
        });
      },
    );
  });

  it("produces a byte-perfect file for a large file without range support", async () => {
    await withTestServer(
      serveFile({ body: LARGE_FILE, acceptRanges: false }),
      async (server) => {
        await withTmpDir(async (dir) => {
          const result = await download(server, dir);
          expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
        });
      },
    );
  });

  it("produces a byte-perfect file for a large file with range support", async () => {
    await withTestServer(
      serveFile({ body: LARGE_FILE, acceptRanges: true }),
      async (server) => {
        await withTmpDir(async (dir) => {
          const result = await download(server, dir);
          expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
        });
      },
    );
  });

  it("falls back to single download when content-length is absent, even with accept-ranges", async () => {
    const handler: RequestHandler = ({ req, res }) => {
      // Omit content-length entirely; advertise range support
      if (req.method === "HEAD") {
        res.writeHead(200, { "accept-ranges": "bytes" });
        res.end();
      } else {
        res.writeHead(200);
        res.end(LARGE_FILE);
      }

      return Promise.resolve();
    };

    await withTestServer(handler, async (server) => {
      await withTmpDir(async (dir) => {
        const result = await download(server, dir);
        expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
        // Only one GET should have been issued (no Range header)
        const gets = server.requests.filter((r) => r.method === "GET");
        expect(gets).toHaveLength(1);
        expect(gets[0].range).toBeNull();
      });
    });
  });

  it("falls back to single download when content-length is zero, even with accept-ranges", async () => {
    // A content-length of 0 parses without error but must not trigger chunking,
    // since size 0 < minFileSizeForChunking. Non-numeric values are rejected by
    // the HTTP parser before got sees them and can't be tested at this level.
    const handler: RequestHandler = ({ req, res }) => {
      if (req.method === "HEAD") {
        res.writeHead(200, { "accept-ranges": "bytes", "content-length": "0" });
        res.end();
      } else {
        res.writeHead(200);
        res.end(LARGE_FILE);
      }

      return Promise.resolve();
    };

    await withTestServer(handler, async (server) => {
      await withTmpDir(async (dir) => {
        const result = await download(server, dir);
        expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
        const gets = server.requests.filter((r) => r.method === "GET");
        expect(gets).toHaveLength(1);
        expect(gets[0].range).toBeNull();
      });
    });
  });

  it("downloads multiple files concurrently and all are byte-perfect", async () => {
    const files = Array.from({ length: 6 }, () =>
      randomBytes(20 * 1024 * 1024),
    );

    await withTmpDir(async (dir) => {
      const downloader = makeDownloader({
        downloadConcurrency: 3,
        chunkConcurrency: 6,
      });

      await Promise.all(
        files.map((file, i) =>
          withTestServer(
            serveFile({ body: file, acceptRanges: true }),
            async (server) => {
              await download(server, dir, downloader, `file-${i}`);
            },
          ),
        ),
      );

      for (const [i, file] of files.entries()) {
        const result = await readFile(path.join(dir, `file-${i}`));
        expect(Buffer.compare(file, result)).toBe(0);
      }
    });
  });

  it("respects downloadConcurrency: 1 and serializes downloads", async () => {
    const completionOrder: number[] = [];
    const files = [randomBytes(1024), randomBytes(1024), randomBytes(1024)];

    await withTmpDir(async (dir) => {
      const downloader = makeDownloader({ downloadConcurrency: 1 });

      await Promise.all(
        files.map((file, i) =>
          withTestServer(
            serveFile({ body: file, acceptRanges: false, delayMs: 30 }),
            async (server) => {
              await download(server, dir, downloader, `file-${i}`);
              completionOrder.push(i);
            },
          ),
        ),
      );

      // With concurrency 1 and equal delay, downloads must have run one at a time;
      // the completion order should match the submission order.
      expect(completionOrder).toEqual([0, 1, 2]);
    });
  });
});
