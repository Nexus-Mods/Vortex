import { randomBytes } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, vi } from "vitest";

import { staticChunker, type Chunk } from "./chunking";
import type { Resolver } from "./resolver";

import {
  Downloader,
  type DownloaderOptions,
  defaultOptions,
} from "./downloader";
import { urlResolver } from "./resolver";
import {
  type TestServer,
  type RequestHandler,
  withTestServer,
  serveFile,
  serveRoutes,
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
  await downloader.download(server.url, dest, urlResolver);
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
        const gets = server.requests.filter((r) => r.method === "GET");
        expect(gets).toHaveLength(1);
        expect(gets[0].range).toBeNull();
      });
    });
  });

  it("falls back to single download when content-length is zero, even with accept-ranges", async () => {
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

      expect(completionOrder).toEqual([0, 1, 2]);
    });
  });

  describe("resolver", () => {
    it("calls the resolver once per download", async () => {
      await withTestServer(
        serveFile({ body: SMALL_FILE, acceptRanges: false }),
        async (server) => {
          await withTmpDir(async (dir) => {
            const resolver = vi.fn(urlResolver);
            const dest = path.join(dir, "output");
            await makeDownloader().download(server.url, dest, resolver);
            expect(resolver).toHaveBeenCalledTimes(1);
            expect(resolver).toHaveBeenCalledWith(server.url);
          });
        },
      );
    });

    it("uses probeUrl as the fallback for chunk requests when chunkUrl is not provided", async () => {
      await withTestServer(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
        async (server) => {
          await withTmpDir(async (dir) => {
            // Resolver returns only probeUrl — no chunkUrl
            const resolver: Resolver<URL> = (url) =>
              Promise.resolve({ probeUrl: url });

            const dest = path.join(dir, "output");
            await makeDownloader().download(server.url, dest, resolver);

            const result = await readFile(dest);
            expect(Buffer.compare(LARGE_FILE, result)).toBe(0);

            // All chunk GETs should have hit the same URL (the probeUrl)
            const gets = server.requests.filter((r) => r.method === "GET");
            expect(gets.length).toBeGreaterThan(1);
            expect(gets.every((r) => r.url === "/")).toBe(true);
          });
        },
      );
    });

    it("uses chunkUrl for each chunk when provided, leaving the probe on probeUrl", async () => {
      await withTestServer(
        serveRoutes({
          "/probe": serveFile({ body: LARGE_FILE, acceptRanges: true }),
          "/chunk": serveFile({ body: LARGE_FILE, acceptRanges: true }),
        }),
        async (server) => {
          await withTmpDir(async (dir) => {
            const chunkUrl = vi.fn((_chunk: Chunk) =>
              Promise.resolve(server.urlFor("/chunk")),
            );
            const resolver: Resolver<URL> = () =>
              Promise.resolve({
                probeUrl: server.urlFor("/probe"),
                chunkUrl,
              });

            const chunksPerFile = 4;
            const chunker = staticChunker(4);

            const dest = path.join(dir, "output");
            await makeDownloader().download(
              server.url,
              dest,
              resolver,
              chunker,
            );

            const result = await readFile(dest);
            expect(Buffer.compare(LARGE_FILE, result)).toBe(0);

            // chunkUrl should have been called once per chunk
            expect(chunkUrl).toHaveBeenCalledTimes(chunksPerFile);

            // Probe HEAD went to /probe, all GETs went to /chunk
            const heads = server.requests.filter((r) => r.method === "HEAD");
            const gets = server.requests.filter((r) => r.method === "GET");
            expect(heads.every((r) => r.url === "/probe")).toBe(true);
            expect(gets.every((r) => r.url === "/chunk")).toBe(true);
          });
        },
      );
    });
  });
});
