import { randomBytes } from "node:crypto";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { VortexError } from "@vortex/shared";
import { assert, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

import { defaultRetryStrategy } from "../transfer/retry";
import { createTestServer, type TestServer } from "./test-server";
import { uploadFile, type UploadOptions } from "./transport";

let server: TestServer;
let tmpDir: string;

beforeAll(async () => {
  [server, tmpDir] = await Promise.all([
    createTestServer(),
    mkdtemp(path.join(os.tmpdir(), "upload-transport-test-")),
  ]);
});

afterAll(() => Promise.all([server.close(), rm(tmpDir, { recursive: true, force: true })]));

beforeEach(() => server.reset());

// Backoff is irrelevant to what these tests assert, so collapse it to ~1ms.
const fastRetry: UploadOptions = { retry: defaultRetryStrategy(3, 1) };

let fileCounter = 0;

async function writeTempFile(contents: Buffer): Promise<string> {
  const filePath = path.join(tmpDir, `upload-${fileCounter++}.bin`);
  await writeFile(filePath, contents);
  return filePath;
}

describe("uploadFile", () => {
  it("PUTs the whole file with a declared content-length", async () => {
    const contents = randomBytes(64 * 1024);
    const filePath = await writeTempFile(contents);

    await uploadFile(`${server.baseUrl}/single`, filePath, contents.length, fastRetry);

    expect(server.requests).toHaveLength(1);
    const request = server.requests[0]!;
    expect(request.method).toBe("PUT");
    expect(request.url).toBe("/single");
    expect(request.headers["content-length"]).toBe(contents.length.toString());
    expect(request.headers["content-type"]).toBe("application/octet-stream");
    expect(request.body.equals(contents)).toBe(true);
  });

  it("retries a transient failure and re-sends the full body", async () => {
    const contents = randomBytes(32 * 1024);
    const filePath = await writeTempFile(contents);

    let attempt = 0;
    server.respondWith((_req, res) => {
      attempt += 1;
      res.writeHead(attempt === 1 ? 503 : 200, attempt === 1 ? {} : { etag: '"etag"' });
      res.end();
    });

    await uploadFile(`${server.baseUrl}/retry`, filePath, contents.length, fastRetry);

    expect(server.requests).toHaveLength(2);
    // The stream is recreated per attempt, so the retry carries every byte.
    expect(server.requests[1]!.body.equals(contents)).toBe(true);
  });

  it("does not retry a client error and reports the status", async () => {
    const filePath = await writeTempFile(randomBytes(128));

    server.respondWith((_req, res) => {
      res.writeHead(403);
      res.end();
    });

    const err = await uploadFile(`${server.baseUrl}/denied`, filePath, 128, fastRetry).catch(
      (e: unknown) => e,
    );

    assert(err instanceof VortexError && err.data.kind === "http:bad-status");
    expect(err.data.statusCode).toBe(403);
    expect(server.requests).toHaveLength(1);
  });

  it("sends the signed headers the caller supplies", async () => {
    const contents = randomBytes(128);
    const filePath = await writeTempFile(contents);

    await uploadFile(`${server.baseUrl}/signed`, filePath, contents.length, {
      ...fastRetry,
      headers: {
        contentType: "application/octet-stream",
        contentDisposition: 'attachment; filename="collection_1.7z"',
      },
    });

    const request = server.requests[0]!;
    expect(request.headers["content-type"]).toBe("application/octet-stream");
    expect(request.headers["content-disposition"]).toBe('attachment; filename="collection_1.7z"');
  });

  it("omits content-disposition when the caller supplies none", async () => {
    const filePath = await writeTempFile(randomBytes(64));

    await uploadFile(`${server.baseUrl}/plain`, filePath, 64, fastRetry);

    expect(server.requests[0]!.headers["content-disposition"]).toBeUndefined();
    // The default stays, for a URL whose signature does not cover it.
    expect(server.requests[0]!.headers["content-type"]).toBe("application/octet-stream");
  });

  it("surfaces the reason the storage gives for a rejection", async () => {
    const filePath = await writeTempFile(randomBytes(128));

    server.respondWith((_req, res) => {
      res.writeHead(403, { "content-type": "application/xml" });
      res.end(
        "<Error><Code>SignatureDoesNotMatch</Code>" +
          "<Message>The request signature we calculated does not match.</Message></Error>",
      );
    });

    const err = await uploadFile(`${server.baseUrl}/denied`, filePath, 128, fastRetry).catch(
      (e: unknown) => e,
    );

    assert(err instanceof VortexError);
    // A bare "Server returned 403" is unactionable; the code names the cause.
    expect(err.message).toContain("SignatureDoesNotMatch");
    expect(err.message).toContain("403");
  });

  it("keeps a signed URL's credentials out of the error payload", async () => {
    const filePath = await writeTempFile(randomBytes(128));

    server.respondWith((_req, res) => {
      res.writeHead(403);
      res.end();
    });

    const err = await uploadFile(
      `${server.baseUrl}/denied?X-Amz-Signature=secret`,
      filePath,
      128,
      fastRetry,
    ).catch((e: unknown) => e);

    assert(err instanceof VortexError);
    expect(err.data).toMatchObject({ url: `${server.baseUrl}/denied` });
    expect(JSON.stringify(err.data)).not.toContain("secret");
  });

  it("reports byte progress up to the full size", async () => {
    const contents = randomBytes(512 * 1024);
    const filePath = await writeTempFile(contents);

    const transferred: number[] = [];
    await uploadFile(`${server.baseUrl}/progress`, filePath, contents.length, {
      ...fastRetry,
      onProgress: (bytes) => transferred.push(bytes),
    });

    expect(transferred.length).toBeGreaterThan(0);
    // Monotonic within a single attempt, and it lands on the whole file.
    expect(transferred).toEqual([...transferred].sort((a, b) => a - b));
    expect(transferred.at(-1)).toBe(contents.length);
  });

  it("restarts progress from zero when an attempt is retried", async () => {
    const contents = randomBytes(256 * 1024);
    const filePath = await writeTempFile(contents);

    let attempt = 0;
    server.respondWith((_req, res) => {
      attempt += 1;
      res.writeHead(attempt === 1 ? 503 : 200, attempt === 1 ? {} : { etag: '"etag"' });
      res.end();
    });

    const transferred: number[] = [];
    await uploadFile(`${server.baseUrl}/progress-retry`, filePath, contents.length, {
      ...fastRetry,
      onProgress: (bytes) => transferred.push(bytes),
    });

    expect(server.requests).toHaveLength(2);
    // The listener is re-attached per attempt, so the second one counts from
    // zero again: somewhere in the sequence a sample is lower than the one
    // before it. How far the first attempt got before the 503 is not fixed, so
    // it is the rewind itself that is asserted, not any particular value.
    const rewound = transferred.some((bytes, i) => i > 0 && bytes < transferred[i - 1]!);
    expect(rewound).toBe(true);
    expect(transferred.at(-1)).toBe(contents.length);
  });

  it("propagates cancellation without retrying", async () => {
    const filePath = await writeTempFile(randomBytes(128));
    const controller = new AbortController();

    server.respondWith((_req, res) => {
      controller.abort();
      res.writeHead(503);
      res.end();
    });

    await expect(
      uploadFile(`${server.baseUrl}/aborted`, filePath, 128, {
        ...fastRetry,
        abortSignal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(server.requests).toHaveLength(1);
  });
});
