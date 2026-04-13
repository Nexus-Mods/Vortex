import { RateLimiter } from "limiter";
import { randomBytes } from "node:crypto";
import { readFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, vi, beforeAll, afterAll, test } from "vitest";

import type { ResolvedResource, ResolvedEndpoint, Resolver } from "./resolver";

import { staticChunker, type Chunk } from "./chunking";
import { download, type TimeoutOptions } from "./downloader";
import { DownloadError } from "@vortex/shared/errors";
import { ProgressReporter } from "./progress";
import { urlResolver } from "./resolver";
import { defaultRetryStrategy } from "./retry";
import {
  type TestServer,
  type RequestHandler,
  createSharedTestServer,
  serveFile,
  serveStatus,
  delayAt,
  delayBeforeChunk,
  withHooks,
  serveDropConnection,
  serveTruncated,
  failFirst,
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
  progressReporter: undefined as ProgressReporter | undefined,
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
    {
      resolver: options.resolver,
      chunker: options.chunker,
    },
    {
      progressReporter: options.progressReporter,
      abortSignal: options.abortController.signal,
    },
  );

  return { promise, dest };
}

describe("download", () => {
  describe("non-chunked resume", () => {
    // Force the non-chunked path even when the server supports ranges
    // by returning an empty chunk list from the chunker.
    const noChunks = () => [];

    it("sends a Range header when resuming with a checkpoint and the server supports ranges", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: noChunks,
      });

      route.requests.length = 0;

      const resumeOffset = 1024 * 1024;
      const checkpoint = {
        etag: null,
        completedRanges: [{ start: 0, end: resumeOffset - 1 }],
      };

      await download(
        route.url,
        dest,
        { resolver: urlResolver, chunker: noChunks },
        { checkpoint },
      );

      const gets = route.requests.filter((r) => r.method === "GET");
      expect(gets).toHaveLength(1);
      expect(gets[0].range).toEqual({
        kind: "bounded",
        start: resumeOffset,
        end: LARGE_FILE.length - 1,
      });
    });

    it("produces a byte-perfect file when resuming a non-chunked download", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: noChunks,
      });

      const resumeOffset = 1024 * 1024;
      const checkpoint = {
        etag: null,
        completedRanges: [{ start: 0, end: resumeOffset - 1 }],
      };

      await download(
        route.url,
        dest,
        { resolver: urlResolver, chunker: noChunks },
        { checkpoint },
      );

      const result = await readFile(dest);
      expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
    });

    it("reports bytesReceived equal to file size after a resumed non-chunked download completes", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: noChunks,
      });

      const resumeOffset = 1024 * 1024;
      const checkpoint = {
        etag: null,
        completedRanges: [{ start: 0, end: resumeOffset - 1 }],
      };

      const progressReporter = new ProgressReporter();
      await download(
        route.url,
        dest,
        { resolver: urlResolver, chunker: noChunks },
        { progressReporter, checkpoint },
      );

      const progress = progressReporter.getProgress();
      expect(progress.bytesReceived).toBe(LARGE_FILE.length);
      expect(progress.bytesWritten).toBe(LARGE_FILE.length);
    });

    it("fast-forwards progress to the checkpoint offset before streaming", async () => {
      using route = server.route(
        withHooks(
          serveFile({ body: LARGE_FILE, acceptRanges: true }),
          delayAt("onRequest", 200),
        ),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: noChunks,
      });

      const resumeOffset = 1024 * 1024;
      const checkpoint = {
        etag: null,
        completedRanges: [{ start: 0, end: resumeOffset - 1 }],
      };

      const progressReporter = new ProgressReporter();
      const abortController = new AbortController();

      const promise = download(
        route.url,
        dest,
        { resolver: urlResolver, chunker: noChunks },
        { progressReporter, abortSignal: abortController.signal, checkpoint },
      );

      await vi.waitFor(
        () => {
          const p = progressReporter.getProgress();
          expect(p.bytesReceived).toBeGreaterThanOrEqual(resumeOffset);
        },
        { timeout: 10_000, interval: 50 },
      );

      abortController.abort();
      await promise.catch(() => {});
    });

    it("does not send a Range header when resuming with an empty checkpoint", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: noChunks,
      });

      route.requests.length = 0;

      const checkpoint = {
        etag: null,
        completedRanges: [],
      };

      await download(
        route.url,
        dest,
        { resolver: urlResolver, chunker: noChunks },
        { checkpoint },
      );

      const gets = route.requests.filter((r) => r.method === "GET");
      expect(gets).toHaveLength(1);
      expect(gets[0].range).toBeNull();
    });

    it("computes writePosition from contiguous ranges starting at zero", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: noChunks,
      });

      const checkpoint = {
        etag: null,
        completedRanges: [
          { start: 0, end: 499_999 },
          { start: 500_000, end: 999_999 },
        ],
      };

      await download(
        route.url,
        dest,
        { resolver: urlResolver, chunker: noChunks },
        { checkpoint },
      );

      const gets = route.requests.filter((r) => r.method === "GET");
      const resumeGet = gets[gets.length - 1];
      expect(resumeGet.range).toEqual({
        kind: "bounded",
        start: 1_000_000,
        end: LARGE_FILE.length - 1,
      });

      const result = await readFile(dest);
      expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
    });

    it("stops at a gap in completed ranges when computing writePosition", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: noChunks,
      });

      const checkpoint = {
        etag: null,
        completedRanges: [
          { start: 0, end: 499_999 },
          { start: 600_000, end: 999_999 },
        ],
      };

      await download(
        route.url,
        dest,
        { resolver: urlResolver, chunker: noChunks },
        { checkpoint },
      );

      const gets = route.requests.filter((r) => r.method === "GET");
      const resumeGet = gets[gets.length - 1];
      expect(resumeGet.range).toEqual({
        kind: "bounded",
        start: 500_000,
        end: LARGE_FILE.length - 1,
      });
    });
  });

  describe("etag checkpoint", () => {
    it("rejects with protocol-violation when the etag changes between checkpoint and re-probe", async () => {
      const originalEtag = '"version-1"';
      const newEtag = '"version-2"';

      const handler: RequestHandler = ({ req, res }) => {
        if (req.method === "HEAD") {
          res.writeHead(200, {
            "accept-ranges": "bytes",
            "content-length": String(LARGE_FILE.length),
            etag: newEtag,
          });
          res.end();
          return Promise.resolve();
        }
        res.writeHead(200);
        res.end(LARGE_FILE);
        return Promise.resolve();
      };

      using route = server.route(handler);
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const checkpoint = {
        etag: originalEtag,
        completedRanges: [{ start: 0, end: 999 }],
      };

      await expect(
        download(
          route.url,
          dest,
          { resolver: urlResolver, chunker: staticChunker() },
          { checkpoint },
        ),
      ).rejects.toMatchObject({
        payload: { code: "protocol-violation", url: route.url },
      });
    });

    it("sends the checkpoint etag as If-Match on the probe request", async () => {
      const etag = '"checkpoint-etag"';

      using route = server.route(
        serveFile({ body: SMALL_FILE, acceptRanges: true, etag }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: staticChunker(),
      });

      const checkpoint = { etag, completedRanges: [] };

      await download(
        route.url,
        dest,
        { resolver: urlResolver, chunker: staticChunker() },
        { checkpoint },
      );

      const heads = route.requests.filter((r) => r.method === "HEAD");
      const resumeHead = heads[heads.length - 1];
      expect(resumeHead.headers["if-match"]).toBe(etag);
    });
  });

  describe("rate limiting", () => {
    it("completes a non-chunked download with a rate limiter", async () => {
      using route = server.route(
        serveFile({ body: SMALL_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const rateLimiter = new RateLimiter({
        tokensPerInterval: 512 * 1024,
        interval: "second",
      });

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: staticChunker(),
        rateLimiter,
      });

      const result = await readFile(dest);
      expect(Buffer.compare(SMALL_FILE, result)).toBe(0);
    });

    it("completes a chunked download with a rate limiter", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const rateLimiter = new RateLimiter({
        tokensPerInterval: 50 * 1024 * 1024,
        interval: "second",
      });

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: staticChunker(),
        rateLimiter,
      });

      const result = await readFile(dest);
      expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
    });

    it("respects cancellation while waiting on the rate limiter", async () => {
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const rateLimiter = new RateLimiter({
        tokensPerInterval: 1,
        interval: "second",
      });

      const abortController = new AbortController();

      const promise = download(
        route.url,
        dest,
        { resolver: urlResolver, chunker: staticChunker(), rateLimiter },
        { abortSignal: abortController.signal },
      );

      setTimeout(() => abortController.abort(), 200);

      await expect(promise).rejects.toMatchObject({
        payload: { code: "cancellation" },
      });
    });
  });

  test.each([
    { file: SMALL_FILE, acceptRanges: false, size: "small" },
    { file: SMALL_FILE, acceptRanges: true, size: "small" },
    { file: LARGE_FILE, acceptRanges: false, size: "large" },
    { file: LARGE_FILE, acceptRanges: true, size: "large" },
  ])(
    "produces a byte-perfect file for a $size file with range support: $acceptRanges",
    async ({ file, acceptRanges }) => {
      using route = server.route(serveFile({ body: file, acceptRanges }));
      await using tmp = await makeTmpDir();
      const result = await completeDownload(route.url, tmp.dir);
      expect(Buffer.compare(file, result)).toBe(0);
    },
  );

  test.each([
    { contentLength: undefined, description: "absent" },
    { contentLength: "0", description: "zero" },
  ])(
    "falls back to single download when content-length is $description, even with accept-ranges",
    async ({ contentLength }) => {
      const handler: RequestHandler = ({ req, res }) => {
        if (req.method === "HEAD") {
          const headers: Record<string, string> = { "accept-ranges": "bytes" };
          if (contentLength !== undefined) {
            headers["content-length"] = contentLength;
          }
          res.writeHead(200, headers);
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
    },
  );

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
      const progressReporter = new ProgressReporter();
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
      const progressReporter = new ProgressReporter();
      await completeDownload(route.url, tmp.dir, { progressReporter });
      expect(progressReporter.getProgress().size).toBeNull();
    });

    test.each([
      { acceptRanges: false, mode: "single" },
      { acceptRanges: true, mode: "chunked" },
    ])(
      "reports bytesReceived equal to file size on completion for a $mode download",
      async ({ acceptRanges }) => {
        using route = server.route(
          serveFile({ body: LARGE_FILE, acceptRanges }),
        );
        await using tmp = await makeTmpDir();
        const progressReporter = new ProgressReporter();
        await completeDownload(route.url, tmp.dir, { progressReporter });
        expect(progressReporter.getProgress().bytesReceived).toBe(
          LARGE_FILE.length,
        );
      },
    );

    it("reports one chunk per chunksPerFile for a chunked download", async () => {
      const chunksPerFile = 4;
      using route = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await using tmp = await makeTmpDir();
      const progressReporter = new ProgressReporter();
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

    it("rejects with is-html when the server returns text/html", async () => {
      using route = server.route(
        serveStatus(200, { "content-type": "text/html; charset=utf-8" }),
      );
      await using tmp = await makeTmpDir();
      await expect(
        runDownload(route.url, tmp.dir).promise,
      ).rejects.toMatchObject({
        payload: { code: "is-html", url: route.url },
      });
    });
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
      const resolver: Resolver<URL> = (u) =>
        Promise.resolve({ probeEndpoint: { url: u } });
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
      const chunkEndpointFn = vi.fn((_chunk: Chunk) =>
        Promise.resolve<ResolvedEndpoint>({ url: chunkRoute.url }),
      );
      const resolver: Resolver<never> = () =>
        Promise.resolve<ResolvedResource>({
          probeEndpoint: { url: probeRoute.url },
          chunkEndpoint: chunkEndpointFn,
        });

      await completeDownload(null, tmp.dir, { resolver });
      expect(chunkEndpointFn).toHaveBeenCalledTimes(chunksPerFile);
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
        const chunkEndpointFn = vi.fn((chunk: Chunk) =>
          Promise.resolve<ResolvedEndpoint>({
            url: chunkRoutes[Math.floor(chunk.range.start / chunkSize)].url,
          }),
        );
        const resolver: Resolver<never> = () =>
          Promise.resolve<ResolvedResource>({
            probeEndpoint: { url: probeRoute.url },
            chunkEndpoint: chunkEndpointFn,
          });

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

  describe("headers", () => {
    it("sends userAgent as User-Agent on the probe request", async () => {
      using route = server.route(
        serveFile({ body: SMALL_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      await download(
        route.url,
        path.join(tmp.dir, "output"),
        { resolver: urlResolver, chunker: staticChunker() },
        { userAgent: "TestAgent/1.0" },
      );
      const head = route.requests.find((r) => r.method === "HEAD");
      expect(head?.headers["user-agent"]).toBe("TestAgent/1.0");
    });

    it("sends userAgent as User-Agent on GET requests", async () => {
      using route = server.route(
        serveFile({ body: SMALL_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      await download(
        route.url,
        path.join(tmp.dir, "output"),
        { resolver: urlResolver, chunker: staticChunker() },
        { userAgent: "TestAgent/1.0" },
      );
      const get = route.requests.find((r) => r.method === "GET");
      expect(get?.headers["user-agent"]).toBe("TestAgent/1.0");
    });

    it("sends resolver headers on the probe request", async () => {
      using route = server.route(
        serveFile({ body: SMALL_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      const resolver: Resolver<URL> = (url) =>
        Promise.resolve({ url, headers: { Referer: "https://example.com" } });
      await download(
        route.url,
        path.join(tmp.dir, "output"),
        { resolver, chunker: staticChunker() },
      );
      const head = route.requests.find((r) => r.method === "HEAD");
      expect(head?.headers["referer"]).toBe("https://example.com");
    });

    it("sends resolver headers on GET requests", async () => {
      using route = server.route(
        serveFile({ body: SMALL_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      const resolver: Resolver<URL> = (url) =>
        Promise.resolve({ url, headers: { Referer: "https://example.com" } });
      await download(
        route.url,
        path.join(tmp.dir, "output"),
        { resolver, chunker: staticChunker() },
      );
      const get = route.requests.find((r) => r.method === "GET");
      expect(get?.headers["referer"]).toBe("https://example.com");
    });

    it("resolver headers overwrite userAgent when keys collide", async () => {
      using route = server.route(
        serveFile({ body: SMALL_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      const resolver: Resolver<URL> = (url) =>
        Promise.resolve({ url, headers: { "User-Agent": "ResolverAgent/2.0" } });
      await download(
        route.url,
        path.join(tmp.dir, "output"),
        { resolver, chunker: staticChunker() },
        { userAgent: "ManagerAgent/1.0" },
      );
      const head = route.requests.find((r) => r.method === "HEAD");
      expect(head?.headers["user-agent"]).toBe("ResolverAgent/2.0");
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

  describe("timeout", () => {
    it("rejects with a network error when the server stalls beyond the stall timeout", async () => {
      using route = server.route(
        withHooks(
          serveFile({
            body: LARGE_FILE,
            acceptRanges: false,
            chunkSize: 1024,
          }),
          delayBeforeChunk(0, 5_000),
        ),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const timeout: TimeoutOptions = {
        request: 30_000,
        lookup: 5_000,
        connect: 5_000,
        stall: 200,
      };

      await expect(
        download(
          route.url,
          dest,
          {
            resolver: urlResolver,
            chunker: staticChunker(),
          },
          {
            timeout,
          },
        ),
      ).rejects.toMatchObject({
        payload: { code: "network-timeout" },
      });
    }, 1_000);

    it("rejects with a network timeout when the request timeout elapses", async () => {
      using route = server.route(
        withHooks(
          serveFile({ body: LARGE_FILE, acceptRanges: false }),
          delayAt("onRequest", 5_000),
        ),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const timeout: TimeoutOptions = {
        request: 200,
        lookup: 5_000,
        connect: 5_000,
        stall: 5_000,
      };

      await expect(
        download(
          route.url,
          dest,
          {
            resolver: urlResolver,
            chunker: staticChunker(),
          },
          {
            timeout,
          },
        ),
      ).rejects.toMatchObject({
        payload: { code: "network-timeout" },
      });
    }, 1_000);

    it("completes successfully when timeouts are generous", async () => {
      using route = server.route(
        serveFile({ body: SMALL_FILE, acceptRanges: false }),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const timeout: TimeoutOptions = {
        request: 30_000,
        lookup: 5_000,
        connect: 5_000,
        stall: 5_000,
      };

      await download(
        route.url,
        dest,
        {
          resolver: urlResolver,
          chunker: staticChunker(),
        },
        {
          timeout,
        },
      );

      const result = await readFile(dest);
      expect(Buffer.compare(SMALL_FILE, result)).toBe(0);
    });

    it("rejects a chunked download when the stall timeout elapses mid-chunk", async () => {
      using route = server.route(
        withHooks(
          serveFile({
            body: LARGE_FILE,
            acceptRanges: true,
            chunkSize: 1024,
          }),
          delayBeforeChunk(0, 5_000),
        ),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const timeout: TimeoutOptions = {
        request: 30_000,
        lookup: 5_000,
        connect: 5_000,
        stall: 200,
      };

      await expect(
        download(
          route.url,
          dest,
          {
            resolver: urlResolver,
            chunker: staticChunker(),
          },
          {
            timeout,
          },
        ),
      ).rejects.toMatchObject({
        payload: { code: "network-timeout" },
      });
    }, 1_000);

    it("rejects with cancellation, not a timeout error, when abort races a timeout", async () => {
      using route = server.route(
        withHooks(
          serveFile({ body: LARGE_FILE, acceptRanges: false }),
          delayAt("onRequest", 5_000),
        ),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const timeout: TimeoutOptions = {
        request: 2_000,
        lookup: 5_000,
        connect: 5_000,
        stall: 5_000,
      };

      const abortController = new AbortController();
      abortController.abort();

      const err = await download(
        route.url,
        dest,
        {
          resolver: urlResolver,
          chunker: staticChunker(),
        },
        {
          timeout,
          abortSignal: abortController.signal,
        },
      ).catch((e) => e);

      expect(err).toBeInstanceOf(DownloadError);
      expect((err as DownloadError).code).toBe("cancellation");
    });
  });

  describe("retry", () => {
    const noChunks = () => [];

    // ── probe retries ──────────────────────────────────────────────

    it("retries a failed probe and succeeds", async () => {
      const { handler } = failFirst(2, {
        failure: serveStatus(503),
        success: serveFile({ body: SMALL_FILE, acceptRanges: false }),
      });
      using route = server.route(handler);
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: staticChunker(),
        retry: defaultRetryStrategy(3, 50, 200),
      });

      const result = await readFile(dest);
      expect(Buffer.compare(SMALL_FILE, result)).toBe(0);

      // 2 failed HEADs + 1 successful HEAD + 1 GET = 4 total,
      // but we only care that 3 HEADs were sent.
      const heads = route.requests.filter((r) => r.method === "HEAD");
      expect(heads).toHaveLength(3);
    });

    it("gives up after exhausting probe retries", async () => {
      // 5 failures but only 2 retries allowed → never reaches success.
      const { handler } = failFirst(5, {
        failure: serveStatus(503),
        success: serveFile({ body: SMALL_FILE, acceptRanges: false }),
      });
      using route = server.route(handler);
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await expect(
        download(route.url, dest, {
          resolver: urlResolver,
          chunker: staticChunker(),
          retry: defaultRetryStrategy(2, 50, 200),
        }),
      ).rejects.toMatchObject({
        payload: { code: "network-bad-status" },
      });
    });

    // ── non-chunked stream retries ─────────────────────────────────

    it("retries a failed non-chunked stream and produces a correct file", async () => {
      const { handler } = failFirst(2, {
        failure: serveDropConnection(),
        success: serveFile({ body: LARGE_FILE, acceptRanges: false }),
      });
      // failFirst counts all requests, but the HEAD always succeeds
      // because the first request (HEAD) is counted as failure #1 by
      // failFirst. To target only GETs we need a thin wrapper that
      // always delegates HEADs to the success handler.
      const inner = serveFile({ body: LARGE_FILE, acceptRanges: false });
      let getFailures = 0;
      const retryHandler: RequestHandler = (ctx) => {
        if (ctx.req.method !== "GET" || getFailures >= 2) return inner(ctx);
        getFailures++;
        return serveDropConnection()(ctx);
      };

      using route = server.route(retryHandler);
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: noChunks,
        retry: defaultRetryStrategy(3, 50, 200),
      });

      const result = await readFile(dest);
      expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
    });

    it("resets progress counters on each non-chunked retry attempt", async () => {
      const inner = serveFile({ body: LARGE_FILE, acceptRanges: false });
      let getFailures = 0;
      const handler: RequestHandler = (ctx) => {
        if (ctx.req.method === "GET" && getFailures < 1) {
          getFailures++;
          return serveDropConnection()(ctx);
        }
        return inner(ctx);
      };

      using route = server.route(handler);
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const progressReporter = new ProgressReporter();

      await download(
        route.url,
        dest,
        {
          resolver: urlResolver,
          chunker: noChunks,
          retry: defaultRetryStrategy(3, 50, 200),
        },
        { progressReporter },
      );

      const progress = progressReporter.getProgress();
      // After recovery the counters must equal the file size exactly,
      // not the file size plus whatever was received before the reset.
      expect(progress.bytesReceived).toBe(LARGE_FILE.length);
      expect(progress.bytesWritten).toBe(LARGE_FILE.length);
    });

    it("resets write position on non-chunked retry so the file is not corrupted", async () => {
      // Serve partial data then kill the socket, twice, then succeed.
      const inner = serveFile({ body: LARGE_FILE, acceptRanges: false });
      let getFailures = 0;
      const handler: RequestHandler = (ctx) => {
        if (ctx.req.method === "GET" && getFailures < 2) {
          getFailures++;
          return serveTruncated(LARGE_FILE, 1024)(ctx);
        }
        return inner(ctx);
      };

      using route = server.route(handler);
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: noChunks,
        retry: defaultRetryStrategy(3, 50, 200),
      });

      const result = await readFile(dest);
      expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
    });

    // ── non-chunked resume + retry ─────────────────────────────────

    it("resets to the checkpoint position (not zero) on non-chunked retry with a checkpoint", async () => {
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      // Use a clean route to create the initial file so the resumed
      // r+ open succeeds. This avoids triggering the fault handler
      // during setup.
      using setupRoute = server.route(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
      );
      await download(setupRoute.url, dest, {
        resolver: urlResolver,
        chunker: noChunks,
      });

      // Now set up the fault-injecting route for the retry test.
      const inner = serveFile({ body: LARGE_FILE, acceptRanges: true });
      let getFailures = 0;
      const handler: RequestHandler = (ctx) => {
        if (ctx.req.method === "GET" && getFailures < 1) {
          getFailures++;
          return serveDropConnection()(ctx);
        }
        return inner(ctx);
      };

      using route = server.route(handler);

      const resumeOffset = 1024 * 1024;
      const checkpoint = {
        etag: null,
        completedRanges: [{ start: 0, end: resumeOffset - 1 }],
      };

      const progressReporter = new ProgressReporter();

      await download(
        route.url,
        dest,
        {
          resolver: urlResolver,
          chunker: noChunks,
          retry: defaultRetryStrategy(3, 50, 200),
        },
        { checkpoint, progressReporter },
      );

      // Both the failed attempt and the retry should have used a Range
      // header starting from the checkpoint offset, not from zero.
      const gets = route.requests.filter((r) => r.method === "GET");
      expect(gets.length).toBeGreaterThanOrEqual(2);
      for (const get of gets) {
        expect(get.range).toMatchObject({ start: resumeOffset });
      }

      // Final progress must reflect the full file size.
      const progress = progressReporter.getProgress();
      expect(progress.bytesReceived).toBe(LARGE_FILE.length);
      expect(progress.bytesWritten).toBe(LARGE_FILE.length);
    });

    // ── chunked retries ────────────────────────────────────────────

    it("retries a failed chunk and produces a correct file", async () => {
      const inner = serveFile({ body: LARGE_FILE, acceptRanges: true });

      let getFailures = 0;
      const handler: RequestHandler = (ctx) => {
        if (ctx.req.method === "GET" && getFailures < 1) {
          getFailures++;
          return serveDropConnection()(ctx);
        }
        return inner(ctx);
      };

      using route = server.route(handler);
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await download(route.url, dest, {
        resolver: urlResolver,
        chunker: staticChunker(),
        retry: defaultRetryStrategy(3, 50, 200),
      });

      const result = await readFile(dest);
      expect(Buffer.compare(LARGE_FILE, result)).toBe(0);
    });

    it("resets chunk progress counters on each chunked retry attempt", async () => {
      const inner = serveFile({ body: LARGE_FILE, acceptRanges: true });

      let getFailures = 0;
      const handler: RequestHandler = (ctx) => {
        if (ctx.req.method === "GET" && getFailures < 1) {
          getFailures++;
          return serveDropConnection()(ctx);
        }
        return inner(ctx);
      };

      using route = server.route(handler);
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const progressReporter = new ProgressReporter();

      await download(
        route.url,
        dest,
        {
          resolver: urlResolver,
          chunker: staticChunker(),
          retry: defaultRetryStrategy(3, 50, 200),
        },
        { progressReporter },
      );

      const progress = progressReporter.getProgress();
      // Total bytes must match the file size exactly — inflated values
      // would indicate the failed attempt's partial bytes leaked through.
      expect(progress.bytesReceived).toBe(LARGE_FILE.length);
      expect(progress.bytesWritten).toBe(LARGE_FILE.length);
    });

    // ── non-retryable errors ───────────────────────────────────────
    it("does not retry non-retryable HTTP status codes", async () => {
      using route = server.route(serveStatus(404));
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      await expect(
        download(route.url, dest, {
          resolver: urlResolver,
          chunker: staticChunker(),
          retry: defaultRetryStrategy(3, 50, 200),
        }),
      ).rejects.toMatchObject({
        payload: { code: "network-bad-status", statusCode: 404 },
      });

      // Only one HEAD was attempted — no retries.
      const heads = route.requests.filter((r) => r.method === "HEAD");
      expect(heads).toHaveLength(1);
    });

    it("does not retry cancellation", async () => {
      using route = server.route(
        withHooks(
          serveFile({ body: LARGE_FILE, acceptRanges: false }),
          delayAt("onRequest", 200),
        ),
      );
      await using tmp = await makeTmpDir();
      const dest = path.join(tmp.dir, "output");

      const abortController = new AbortController();
      abortController.abort();

      await expect(
        download(
          route.url,
          dest,
          {
            resolver: urlResolver,
            chunker: staticChunker(),
            retry: defaultRetryStrategy(3, 50, 200),
          },
          { abortSignal: abortController.signal },
        ),
      ).rejects.toMatchObject({
        payload: { code: "cancellation" },
      });
    });
  });
});
