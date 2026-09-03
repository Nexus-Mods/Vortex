import { randomBytes } from "node:crypto";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { VortexError } from "@vortex/shared";
import { assert, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

import { defaultRetryStrategy } from "../transfer/retry";
import { uploadS3Multipart } from "./s3Multipart";
import { createTestServer, respondOk, type TestServer } from "./test-server";
import type { UploadOptions } from "./transport";

let server: TestServer;
let tmpDir: string;

beforeAll(async () => {
  [server, tmpDir] = await Promise.all([
    createTestServer(),
    mkdtemp(path.join(os.tmpdir(), "upload-s3-test-")),
  ]);
});

afterAll(() => Promise.all([server.close(), rm(tmpDir, { recursive: true, force: true })]));

beforeEach(() => server.reset());

// Backoff is irrelevant to what these tests assert, so collapse it to ~1ms.
const fastRetry: UploadOptions = { retry: defaultRetryStrategy(3, 1) };

let fileCounter = 0;

async function writeTempFile(contents: Buffer): Promise<string> {
  const filePath = path.join(tmpDir, `multipart-${fileCounter++}.bin`);
  await writeFile(filePath, contents);
  return filePath;
}

function layout(partSizeBytes: number, parts: number) {
  return {
    partSizeBytes,
    partPresignedUrls: Array.from({ length: parts }, (_, i) => `${server.baseUrl}/part${i + 1}`),
    completePresignedUrl: `${server.baseUrl}/complete`,
  };
}

describe("uploadS3Multipart", () => {
  it("uploads every part in order and completes with the collected ETags", async () => {
    const contents = randomBytes(250);
    const filePath = await writeTempFile(contents);

    await uploadS3Multipart(layout(100, 3), filePath, contents.length, fastRetry);

    const parts = server.requests.filter((r) => r.method === "PUT");
    expect(parts.map((r) => r.url)).toEqual(["/part1", "/part2", "/part3"]);
    expect(parts.map((r) => r.body.length)).toEqual([100, 100, 50]);
    expect(Buffer.concat(parts.map((r) => r.body)).equals(contents)).toBe(true);

    const completion = server.requests.at(-1)!;
    expect(completion.method).toBe("POST");
    expect(completion.url).toBe("/complete");
    expect(completion.headers["content-type"]).toBe("application/xml");

    const xml = completion.body.toString();
    expect(xml).toContain("<CompleteMultipartUpload>");
    for (const partNumber of [1, 2, 3]) {
      expect(xml).toContain(`<PartNumber>${partNumber}</PartNumber>`);
      expect(xml).toContain(`<ETag>"etag-part${partNumber}"</ETag>`);
    }
  });

  it("reports progress across the whole file, not per part", async () => {
    const contents = randomBytes(250);
    const filePath = await writeTempFile(contents);

    const transferred: number[] = [];
    await uploadS3Multipart(layout(100, 3), filePath, contents.length, {
      ...fastRetry,
      onProgress: (bytes) => transferred.push(bytes),
    });

    // Each part's count is offset by the bytes already behind it, so the
    // sequence climbs to the file size instead of restarting at every part.
    expect(transferred).toEqual([...transferred].sort((a, b) => a - b));
    expect(transferred.at(-1)).toBe(contents.length);
    expect(Math.max(...transferred)).toBeLessThanOrEqual(contents.length);
  });

  it("rejects a layout that does not match the file size before uploading", async () => {
    const filePath = await writeTempFile(randomBytes(250));

    // 250 bytes at 100 bytes/part needs 3 parts, but only 1 URL was issued.
    const err = await uploadS3Multipart(layout(100, 1), filePath, 250, fastRetry).catch(
      (e: unknown) => e,
    );

    assert(err instanceof VortexError && err.data.kind === "http:protocol-violation");
    expect(err.message).toMatch(/Multipart layout mismatch/);
    expect(server.requests).toHaveLength(0);
  });

  it("fails when a part response carries no ETag", async () => {
    const filePath = await writeTempFile(randomBytes(50));

    server.respondWith((_req, res) => {
      res.writeHead(200);
      res.end();
    });

    const err = await uploadS3Multipart(layout(100, 1), filePath, 50, fastRetry).catch(
      (e: unknown) => e,
    );

    assert(err instanceof VortexError && err.data.kind === "http:protocol-violation");
    expect(err.message).toMatch(/ETag/);
  });

  it("retries the completion request on a server error", async () => {
    const filePath = await writeTempFile(randomBytes(50));

    let completionAttempts = 0;
    server.respondWith((req, res) => {
      if (req.method === "POST") {
        completionAttempts += 1;
        if (completionAttempts === 1) {
          res.writeHead(500);
          res.end("Internal Server Error");
          return;
        }
      }
      respondOk(req, res);
    });

    await uploadS3Multipart(layout(100, 1), filePath, 50, fastRetry);

    expect(completionAttempts).toBe(2);
  });

  it("treats an <Error> body under a 200 completion as a failure", async () => {
    const filePath = await writeTempFile(randomBytes(50));

    server.respondWith((req, res) => {
      if (req.method === "POST") {
        res.writeHead(200, { "content-type": "application/xml" });
        res.end("<Error><Code>InternalError</Code></Error>");
        return;
      }
      respondOk(req, res);
    });

    const err = await uploadS3Multipart(layout(100, 1), filePath, 50, fastRetry).catch(
      (e: unknown) => e,
    );

    assert(err instanceof VortexError && err.data.kind === "http:protocol-violation");
    expect(err.message).toContain("InternalError");
  });
});
