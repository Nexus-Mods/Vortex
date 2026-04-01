import { randomBytes } from "node:crypto";
import { readFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

import type { Resolver } from "./resolver";

import { staticChunker, type Chunk } from "./chunking";
import { download } from "./downloader";
import { DownloadError } from "./errors";
import { ProgressReporter } from "./progress";
import { urlResolver } from "./resolver";
import {
  type TestServer,
  type RequestHandler,
  createTestServer,
  serveFile,
  serveStatus,
} from "./test-server";

const LARGE_FILE = randomBytes(20 * 1024 * 1024);
const SMALL_FILE = randomBytes(1024);

let server: TestServer;
let tmpDir: string;

beforeAll(async () => {
  [server, tmpDir] = await Promise.all([
    createTestServer(({ res }) => {
      res.writeHead(404);
      res.end();
      return Promise.resolve();
    }),
    mkdtemp(path.join(os.tmpdir(), "downloader-test-")),
  ]);
});

afterAll(() =>
  Promise.all([server.close(), rm(tmpDir, { recursive: true, force: true })]),
);

let dirCounter = 0;

async function withTmpDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = path.join(tmpDir, String(++dirCounter));
  await mkdir(dir);
  return fn(dir);
}

function makeProgressReporter() {
  return new ProgressReporter();
}

async function completeDownload(
  url: URL,
  destDir: string,
  opts?: Partial<ReturnType<typeof defaultOptions>>,
): Promise<Buffer> {
  const { promise, dest } = runDownload(url, destDir, opts);
  await promise;
  return readFile(dest);
}

const defaultOptions = () => ({
  filename: "output",
  resolver: urlResolver,
  chunker: staticChunker(),
  progressReporter: makeProgressReporter(),
  abortController: new AbortController(),
});

function runDownload(
  url: URL,
  destDir: string,
  opts?: Partial<ReturnType<typeof defaultOptions>>,
): { promise: Promise<void>; dest: string } {
  const options = { ...defaultOptions(), ...opts };

  const dest = path.join(destDir, options.filename);
  const promise = download(
    url,
    dest,
    options.resolver,
    options.chunker,
    options.progressReporter,
    options.abortController.signal,
  );

  return { promise, dest };
}

describe("download", () => {
  it("produces a byte-perfect file for a small file without range support", async () => {
    const { url, deregister } = server.route(
      serveFile({ body: SMALL_FILE, acceptRanges: false }),
    );
    try {
      await withTmpDir(async (dir) => {
        const result = await completeDownload(url, dir);
        expect(Buffer.compare(SMALL_FILE, result)).toBe(0);
      });
    } finally {
      deregister();
    }
  });

  it("produces a byte-perfect file for a small file with range support", async () => {
    const { url, deregister } = server.route(
      serveFile({ body: SMALL_FILE, acceptRanges: true }),
    );
    try {
      await withTmpDir(async (dir) => {
        const result = await completeDownload(url, dir);
        expect(Buffer.compare(SMALL_FILE, result)).toBe(0);
      });
    } finally {
      deregister();
    }
  });

  it("produces a byte-perfect file for a large file without range support", async () => {
    const { url, deregister } = server.route(
      serveFile({ body: LARGE_FILE, acceptRanges: false }),
    );
    try {
      await withTmpDir(async (dir) => {
        const result = await completeDownload(url, dir);
        expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
      });
    } finally {
      deregister();
    }
  });

  it("produces a byte-perfect file for a large file with range support", async () => {
    const { url, deregister } = server.route(
      serveFile({ body: LARGE_FILE, acceptRanges: true }),
    );
    try {
      await withTmpDir(async (dir) => {
        const result = await completeDownload(url, dir);
        expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
      });
    } finally {
      deregister();
    }
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

    const { url, deregister } = server.route(handler);
    try {
      await withTmpDir(async (dir) => {
        const result = await completeDownload(url, dir);
        expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
        const gets = server.requests.filter(
          (r) => r.method === "GET" && r.url === url.pathname,
        );
        expect(gets).toHaveLength(1);
        expect(gets[0].range).toBeNull();
      });
    } finally {
      deregister();
    }
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

    const { url, deregister } = server.route(handler);
    try {
      await withTmpDir(async (dir) => {
        const result = await completeDownload(url, dir);
        expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
        const gets = server.requests.filter(
          (r) => r.method === "GET" && r.url === url.pathname,
        );
        expect(gets).toHaveLength(1);
        expect(gets[0].range).toBeNull();
      });
    } finally {
      deregister();
    }
  });

  describe("progress", () => {
    it("reports correct totalBytes for a single download with content-length", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: false }),
      );
      try {
        await withTmpDir(async (dir) => {
          const progressReporter = makeProgressReporter();
          await completeDownload(url, dir, {
            progressReporter,
          });

          expect(progressReporter.getProgress().totalBytes).toBe(
            LARGE_FILE.length,
          );
        });
      } finally {
        deregister();
      }
    });

    it("reports null totalBytes for a single download without content-length", async () => {
      const handler: RequestHandler = ({ req, res }) => {
        if (req.method === "HEAD") {
          res.writeHead(200);
          res.end();
        } else {
          res.writeHead(200);
          res.end(LARGE_FILE);
        }
        return Promise.resolve();
      };

      const { url, deregister } = server.route(handler);
      try {
        await withTmpDir(async (dir) => {
          const progressReporter = makeProgressReporter();
          await completeDownload(url, dir, {
            progressReporter,
          });

          expect(progressReporter.getProgress().totalBytes).toBeNull();
        });
      } finally {
        deregister();
      }
    });

    it("reports bytesReceived equal to file size on completion for a single download", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: false }),
      );
      try {
        await withTmpDir(async (dir) => {
          const progressReporter = makeProgressReporter();
          await completeDownload(url, dir, {
            progressReporter,
          });

          expect(progressReporter.getProgress().bytesReceived).toBe(
            LARGE_FILE.length,
          );
        });
      } finally {
        deregister();
      }
    });

    it("reports bytesReceived equal to file size on completion for a chunked download", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      try {
        await withTmpDir(async (dir) => {
          const progressReporter = makeProgressReporter();
          await completeDownload(url, dir, {
            progressReporter,
          });

          expect(progressReporter.getProgress().bytesReceived).toBe(
            LARGE_FILE.length,
          );
        });
      } finally {
        deregister();
      }
    });

    it("reports one chunk per chunksPerFile for a chunked download", async () => {
      const chunksPerFile = 4;
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      try {
        await withTmpDir(async (dir) => {
          const progressReporter = makeProgressReporter();
          await completeDownload(url, dir, {
            progressReporter,
          });

          expect(progressReporter.getProgress().chunks).toHaveLength(
            chunksPerFile,
          );
        });
      } finally {
        deregister();
      }
    });

    it("reports a single chunk for a non-chunked download", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: false }),
      );
      try {
        await withTmpDir(async (dir) => {
          const progressReporter = makeProgressReporter();
          await completeDownload(url, dir, {
            progressReporter,
          });

          expect(progressReporter.getProgress().chunks).toHaveLength(1);
        });
      } finally {
        deregister();
      }
    });
  });

  describe("etag", () => {
    it("sends If-Match on chunk requests when probe returns a strong etag", async () => {
      const etag = '"abc123"';
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true, etag }),
      );
      try {
        await withTmpDir(async (dir) => {
          await completeDownload(url, dir);
          const gets = server.requests.filter(
            (r) => r.method === "GET" && r.url === url.pathname,
          );
          expect(gets.length).toBeGreaterThan(0);
          expect(gets.every((r) => r.headers["if-match"] === etag)).toBe(true);
        });
      } finally {
        deregister();
      }
    });

    it("does not send If-Match on chunk requests when probe returns a weak etag", async () => {
      const etag = 'W/"abc123"';
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true, etag }),
      );
      try {
        await withTmpDir(async (dir) => {
          await completeDownload(url, dir);
          const gets = server.requests.filter(
            (r) => r.method === "GET" && r.url === url.pathname,
          );
          expect(gets.length).toBeGreaterThan(0);
          expect(gets.every((r) => !r.headers["if-match"])).toBe(true);
        });
      } finally {
        deregister();
      }
    });

    it("does not send If-Match when probe returns no etag", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      try {
        await withTmpDir(async (dir) => {
          await completeDownload(url, dir);
          const gets = server.requests.filter(
            (r) => r.method === "GET" && r.url === url.pathname,
          );
          expect(gets.length).toBeGreaterThan(0);
          expect(gets.every((r) => !r.headers["if-match"])).toBe(true);
        });
      } finally {
        deregister();
      }
    });

    it("rejects with precondition-failed when resource changes mid-download", async () => {
      const etag = '"original"';
      const handler: RequestHandler = ({ req, res }) => {
        if (req.method === "HEAD") {
          res.writeHead(200, {
            "accept-ranges": "bytes",
            "content-length": LARGE_FILE.length,
            etag,
          });
          res.end();
          return Promise.resolve();
        }
        res.writeHead(412);
        res.end();
        return Promise.resolve();
      };

      const { url, deregister } = server.route(handler);
      try {
        await withTmpDir(async (dir) => {
          await expect(runDownload(url, dir).promise).rejects.toMatchObject({
            payload: { code: "precondition-failed", url },
          });
        });
      } finally {
        deregister();
      }
    });
  });

  describe("errors", () => {
    it.each([403, 404, 410])(
      "rejects with a DownloadError for HTTP %i",
      async (statusCode) => {
        const { url, deregister } = server.route(serveStatus(statusCode));
        try {
          await withTmpDir(async (dir) => {
            const dest = path.join(dir, "output");
            await expect(runDownload(url, dest).promise).rejects.toMatchObject({
              payload: { code: "network-bad-status", statusCode, url },
            });
          });
        } finally {
          deregister();
        }
      },
    );
  });

  describe("resolver", () => {
    it("calls the resolver once per download", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: SMALL_FILE, acceptRanges: false }),
      );
      try {
        await withTmpDir(async (dir) => {
          const resolver = vi.fn(urlResolver);
          await completeDownload(url, dir, { resolver });

          expect(resolver).toHaveBeenCalledTimes(1);
          expect(resolver).toHaveBeenCalledWith(url);
        });
      } finally {
        deregister();
      }
    });

    it("uses probeUrl as the fallback for chunk requests when chunkUrl is not provided", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      try {
        await withTmpDir(async (dir) => {
          const resolver: Resolver<URL> = (u) =>
            Promise.resolve({ probeUrl: u });
          await completeDownload(url, dir, { resolver });

          const gets = server.requests.filter(
            (r) => r.method === "GET" && r.url === url.pathname,
          );
          expect(gets.length).toBeGreaterThan(1);
        });
      } finally {
        deregister();
      }
    });

    it("uses chunkUrl for each chunk when provided, leaving the probe on probeUrl", async () => {
      const { url: probeUrl, deregister: deregisterProbe } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      const { url: chunkUrl, deregister: deregisterChunk } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );

      try {
        await withTmpDir(async (dir) => {
          const chunkUrlFn = vi.fn((_chunk: Chunk) =>
            Promise.resolve(chunkUrl),
          );
          const resolver: Resolver<never> = () =>
            Promise.resolve({ probeUrl, chunkUrl: chunkUrlFn });

          const chunksPerFile = 4;
          await completeDownload(null, dir, { resolver });
          expect(chunkUrlFn).toHaveBeenCalledTimes(chunksPerFile);

          const heads = server.requests.filter(
            (r) => r.method === "HEAD" && r.url === probeUrl.pathname,
          );
          const gets = server.requests.filter(
            (r) => r.method === "GET" && r.url === chunkUrl.pathname,
          );
          expect(heads).toHaveLength(1);
          expect(gets).toHaveLength(chunksPerFile);
        });
      } finally {
        deregisterProbe();
        deregisterChunk();
      }
    });

    it("routes each chunk to a different endpoint", async () => {
      const chunksPerFile = 4;
      const chunker = staticChunker(chunksPerFile);
      const chunkSize = Math.ceil(LARGE_FILE.length / chunksPerFile);
      const { url: probeUrl, deregister: deregisterProbe } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      const chunkRoutes = Array.from({ length: chunksPerFile }, () =>
        server.route(serveFile({ body: LARGE_FILE, acceptRanges: true })),
      );

      try {
        await withTmpDir(async (dir) => {
          const chunkUrlFn = vi.fn((chunk: Chunk) => {
            const i = Math.floor(chunk.start / chunkSize);
            return Promise.resolve(chunkRoutes[i].url);
          });
          const resolver: Resolver<never> = () =>
            Promise.resolve({ probeUrl, chunkUrl: chunkUrlFn });

          await completeDownload(null, dir, { resolver, chunker });

          for (const { url } of chunkRoutes) {
            const requests = server.requests.filter(
              (r) => r.method === "GET" && r.url === url.pathname,
            );
            expect(requests).toHaveLength(1);
            expect(requests[0].range).not.toBeNull();
          }
        });
      } finally {
        deregisterProbe();
        chunkRoutes.forEach(({ deregister }) => deregister());
      }
    });
  });

  describe("cancellation", () => {
    it("rejects with code 'cancellation' when cancelled before the probe", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true, delayForHEAD: 200 }),
      );
      try {
        await withTmpDir(async (dir) => {
          const abortController = new AbortController();
          abortController.abort();
          await expect(
            runDownload(url, dir, { abortController }).promise,
          ).rejects.toMatchObject({ payload: { code: "cancellation" } });
        });
      } finally {
        deregister();
      }
    });

    it("rejects with code 'cancellation' when cancelled during a single (non-chunked) download", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: false, delayForGET: 200 }),
      );
      try {
        await withTmpDir(async (dir) => {
          const abortController = new AbortController();
          const { promise } = runDownload(url, dir, { abortController });
          abortController.abort();
          await expect(promise).rejects.toMatchObject({
            payload: { code: "cancellation" },
          });
        });
      } finally {
        deregister();
      }
    });

    it("rejects with code 'cancellation' when cancelled during a chunked download", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true, delayForGET: 200 }),
      );
      try {
        await withTmpDir(async (dir) => {
          const abortController = new AbortController();
          const { promise } = runDownload(url, dir, { abortController });
          abortController.abort();
          await expect(promise).rejects.toMatchObject({
            payload: { code: "cancellation" },
          });
        });
      } finally {
        deregister();
      }
    });

    it("rejects with a DownloadError, not a raw DOMException or AbortError", async () => {
      const { url, deregister } = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true, delayForHEAD: 200 }),
      );
      try {
        await withTmpDir(async (dir) => {
          const abortController = new AbortController();
          abortController.abort();
          const err = await runDownload(url, dir, {
            abortController,
          }).promise.catch((e) => e);
          expect(err).toBeInstanceOf(DownloadError);
          expect((err as DownloadError).code).toBe("cancellation");
        });
      } finally {
        deregister();
      }
    });
  });
});
