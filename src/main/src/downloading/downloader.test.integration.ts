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
  createSharedTestServer,
  serveFile,
  serveStatus,
  delayAt,
  delayBeforeChunk,
  withHooks,
} from "./test-server";

const LARGE_FILE = randomBytes(20 * 1024 * 1024);
const SMALL_FILE = randomBytes(1024);

let server: TestServer;
let tmpDir: string;

beforeAll(async () => {
  [server, tmpDir] = await Promise.all([
    createSharedTestServer(),
    mkdtemp(path.join(os.tmpdir(), "downloader-test-")),
  ]);
});

afterAll(() =>
  Promise.all([server.close(), rm(tmpDir, { recursive: true, force: true })]),
);

let dirCounter = 0;

class TmpDir implements AsyncDisposable {
  constructor(readonly dir: string) {}
  [Symbol.asyncDispose]() {
    return rm(this.dir, { recursive: true, force: true });
  }
}

async function makeTmpDir(): Promise<TmpDir> {
  const dir = path.join(tmpDir, String(++dirCounter));
  await mkdir(dir);
  return new TmpDir(dir);
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
    using route = server.route(
      serveFile({ body: SMALL_FILE, acceptRanges: false }),
    );
    await using tmp = await makeTmpDir();
    const result = await completeDownload(route.url, tmp.dir);
    expect(Buffer.compare(SMALL_FILE, result)).toBe(0);
  });

  it("produces a byte-perfect file for a small file with range support", async () => {
    using route = server.route(
      serveFile({ body: SMALL_FILE, acceptRanges: true }),
    );
    await using tmp = await makeTmpDir();
    const result = await completeDownload(route.url, tmp.dir);
    expect(Buffer.compare(SMALL_FILE, result)).toBe(0);
  });

  it("produces a byte-perfect file for a large file without range support", async () => {
    using route = server.route(
      serveFile({ body: LARGE_FILE, acceptRanges: false }),
    );
    await using tmp = await makeTmpDir();
    const result = await completeDownload(route.url, tmp.dir);
    expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
  });

  it("produces a byte-perfect file for a large file with range support", async () => {
    using route = server.route(
      serveFile({ body: LARGE_FILE, acceptRanges: true }),
    );
    await using tmp = await makeTmpDir();
    const result = await completeDownload(route.url, tmp.dir);
    expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
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

    using route = server.route(handler);
    await using tmp = await makeTmpDir();
    const result = await completeDownload(route.url, tmp.dir);
    expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
    const gets = route.requests.filter((r) => r.method === "GET");
    expect(gets).toHaveLength(1);
    expect(gets[0].range).toBeNull();
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

    using route = server.route(handler);
    await using tmp = await makeTmpDir();
    const result = await completeDownload(route.url, tmp.dir);
    expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
    const gets = route.requests.filter((r) => r.method === "GET");
    expect(gets).toHaveLength(1);
    expect(gets[0].range).toBeNull();
  });

  it("rejects with protocol-violation when a chunk response exceeds the requested byte range", async () => {
    const handler: RequestHandler = ({ req, res }) => {
      if (req.method === "HEAD") {
        res.writeHead(200, {
          "accept-ranges": "bytes",
          "content-length": String(LARGE_FILE.length),
        });
        res.end();
        return Promise.resolve();
      }

      // Honour the range header for the Content-Range, but send the full file
      // body — more bytes than the declared range covers.
      const range = req.headers["range"] ?? "bytes=0-0";
      res.writeHead(206, {
        "content-range": `${range.replace("=", " ")}/${LARGE_FILE.length}`,
        "content-length": String(LARGE_FILE.length),
      });
      res.end(LARGE_FILE);
      return Promise.resolve();
    };

    using route = server.route(handler);
    await using tmp = await makeTmpDir();

    await expect(runDownload(route.url, tmp.dir).promise).rejects.toMatchObject(
      {
        payload: { code: "protocol-violation", url: route.url },
      },
    );
  });

  describe("progress", () => {
    it("reports correct totalBytes for a single download with content-length", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      const progressReporter = makeProgressReporter();
      await completeDownload(route.url, tmp.dir, { progressReporter });
      expect(progressReporter.getProgress().size).toBe(LARGE_FILE.length);
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

      using route = server.route(handler);
      await using tmp = await makeTmpDir();
      const progressReporter = makeProgressReporter();
      await completeDownload(route.url, tmp.dir, { progressReporter });
      expect(progressReporter.getProgress().size).toBeNull();
    });

    it("reports bytesReceived equal to file size on completion for a single download", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      const progressReporter = makeProgressReporter();
      await completeDownload(route.url, tmp.dir, { progressReporter });
      expect(progressReporter.getProgress().bytesReceived).toBe(
        LARGE_FILE.length,
      );
    });

    it("reports bytesReceived equal to file size on completion for a chunked download", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const progressReporter = makeProgressReporter();
      await completeDownload(route.url, tmp.dir, { progressReporter });
      expect(progressReporter.getProgress().bytesReceived).toBe(
        LARGE_FILE.length,
      );
    });

    it("reports one chunk per chunksPerFile for a chunked download", async () => {
      const chunksPerFile = 4;
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const progressReporter = makeProgressReporter();
      await completeDownload(route.url, tmp.dir, { progressReporter });

      const progress = progressReporter.getProgress();
      expect(progress.isChunked).toBe(true);
      if (progress.isChunked) {
        expect(progress.chunks).toHaveLength(chunksPerFile);
      }
    });
  });

  describe("etag", () => {
    it("sends If-Match on chunk requests when probe returns a strong etag", async () => {
      const etag = '"abc123"';
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true, etag }),
      );
      await using tmp = await makeTmpDir();
      await completeDownload(route.url, tmp.dir);
      const gets = route.requests.filter((r) => r.method === "GET");
      expect(gets.length).toBeGreaterThan(0);
      expect(gets.every((r) => r.headers["if-match"] === etag)).toBe(true);
    });

    it("does not send If-Match on chunk requests when probe returns a weak etag", async () => {
      const etag = 'W/"abc123"';
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true, etag }),
      );
      await using tmp = await makeTmpDir();
      await completeDownload(route.url, tmp.dir);
      const gets = route.requests.filter((r) => r.method === "GET");
      expect(gets.length).toBeGreaterThan(0);
      expect(gets.every((r) => !r.headers["if-match"])).toBe(true);
    });

    it("does not send If-Match when probe returns no etag", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      await completeDownload(route.url, tmp.dir);
      const gets = route.requests.filter((r) => r.method === "GET");
      expect(gets.length).toBeGreaterThan(0);
      expect(gets.every((r) => !r.headers["if-match"])).toBe(true);
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

      using route = server.route(handler);
      await using tmp = await makeTmpDir();
      await expect(
        runDownload(route.url, tmp.dir).promise,
      ).rejects.toMatchObject({
        payload: { code: "precondition-failed", url: route.url },
      });
    });
  });

  describe("errors", () => {
    it.each([403, 404, 410])(
      "rejects with a DownloadError for HTTP %i",
      async (statusCode) => {
        using route = server.route(serveStatus(statusCode));
        await using tmp = await makeTmpDir();
        const dest = path.join(tmp.dir, "output");
        await expect(
          runDownload(route.url, dest).promise,
        ).rejects.toMatchObject({
          payload: { code: "network-bad-status", statusCode, url: route.url },
        });
      },
    );
  });

  describe("resolver", () => {
    it("calls the resolver once per download", async () => {
      using route = server.route(
        serveFile({ body: SMALL_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      const resolver = vi.fn(urlResolver);
      await completeDownload(route.url, tmp.dir, { resolver });
      expect(resolver).toHaveBeenCalledTimes(1);
      expect(resolver).toHaveBeenCalledWith(route.url);
    });

    it("uses probeUrl as the fallback for chunk requests when chunkUrl is not provided", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const resolver: Resolver<URL> = (u) => Promise.resolve({ probeUrl: u });
      await completeDownload(route.url, tmp.dir, { resolver });
      expect(
        route.requests.filter((r) => r.method === "GET").length,
      ).toBeGreaterThan(1);
    });

    it("uses chunkUrl for each chunk when provided, leaving the probe on probeUrl", async () => {
      const chunksPerFile = 4;
      using probeRoute = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      using chunkRoute = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const chunkUrlFn = vi.fn((_chunk: Chunk) =>
        Promise.resolve(chunkRoute.url),
      );
      const resolver: Resolver<never> = () =>
        Promise.resolve({ probeUrl: probeRoute.url, chunkUrl: chunkUrlFn });

      await completeDownload(null, tmp.dir, { resolver });
      expect(chunkUrlFn).toHaveBeenCalledTimes(chunksPerFile);
      expect(
        probeRoute.requests.filter((r) => r.method === "HEAD"),
      ).toHaveLength(1);
      expect(
        chunkRoute.requests.filter((r) => r.method === "GET"),
      ).toHaveLength(chunksPerFile);
    });

    it("routes each chunk to a different endpoint", async () => {
      const chunksPerFile = 4;
      const chunker = staticChunker(chunksPerFile);
      const chunkSize = Math.ceil(LARGE_FILE.length / chunksPerFile);
      using probeRoute = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      const chunkRoutes = Array.from({ length: chunksPerFile }, () =>
        server.route(serveFile({ body: LARGE_FILE, acceptRanges: true })),
      );
      try {
        await using tmp = await makeTmpDir();
        const chunkUrlFn = vi.fn((chunk: Chunk) =>
          Promise.resolve(
            chunkRoutes[Math.floor(chunk.range.start / chunkSize)].url,
          ),
        );
        const resolver: Resolver<never> = () =>
          Promise.resolve({ probeUrl: probeRoute.url, chunkUrl: chunkUrlFn });

        await completeDownload(null, tmp.dir, { resolver, chunker });

        for (const chunkRoute of chunkRoutes) {
          const gets = chunkRoute.requests.filter((r) => r.method === "GET");
          expect(gets).toHaveLength(1);
          expect(gets[0].range).not.toBeNull();
        }
      } finally {
        chunkRoutes.forEach((r) => r.deregister());
      }
    });
  });

  describe("cancellation", () => {
    it("rejects with code 'cancellation' when cancelled before the probe", async () => {
      using route = server.route(
        withHooks(
          serveFile({ body: LARGE_FILE, acceptRanges: true }),
          delayAt("onRequest", 200),
        ),
      );
      await using tmp = await makeTmpDir();
      const abortController = new AbortController();
      abortController.abort();
      await expect(
        runDownload(route.url, tmp.dir, { abortController }).promise,
      ).rejects.toMatchObject({ payload: { code: "cancellation" } });
    });

    it("rejects with code 'cancellation' when cancelled during a single (non-chunked) download", async () => {
      using route = server.route(
        withHooks(
          serveFile({
            body: LARGE_FILE,
            acceptRanges: false,
            chunkSize: 64 * 1024,
          }),
          delayBeforeChunk(0, 10),
        ),
      );
      await using tmp = await makeTmpDir();
      const abortController = new AbortController();
      const { promise } = runDownload(route.url, tmp.dir, { abortController });
      abortController.abort();
      await expect(promise).rejects.toMatchObject({
        payload: { code: "cancellation" },
      });
    });

    it("rejects with code 'cancellation' when cancelled during a chunked download", async () => {
      using route = server.route(
        withHooks(
          serveFile({ body: LARGE_FILE, acceptRanges: true }),
          delayAt("onRequest", 200),
        ),
      );
      await using tmp = await makeTmpDir();
      const abortController = new AbortController();
      const { promise } = runDownload(route.url, tmp.dir, { abortController });
      abortController.abort();
      await expect(promise).rejects.toMatchObject({
        payload: { code: "cancellation" },
      });
    });

    it("rejects with a DownloadError, not a raw DOMException or AbortError", async () => {
      using route = server.route(
        withHooks(
          serveFile({ body: LARGE_FILE, acceptRanges: true }),
          delayAt("onRequest", 200),
        ),
      );
      await using tmp = await makeTmpDir();
      const abortController = new AbortController();
      abortController.abort();
      const err = await runDownload(route.url, tmp.dir, {
        abortController,
      }).promise.catch((e) => e);
      expect(err).toBeInstanceOf(DownloadError);
      expect((err as DownloadError).code).toBe("cancellation");
    });
  });
});
