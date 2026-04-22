import { Readable } from "stream";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../logging", () => ({
  log: vi.fn(),
}));

vi.mock("../../../util/network", () => ({
  uploadWithHeaders: vi.fn(),
}));

vi.mock("fs", () => ({
  default: { createReadStream: vi.fn(() => Readable.from(Buffer.alloc(0))) },
  createReadStream: vi.fn(() => Readable.from(Buffer.alloc(0))),
}));

import type { NexusV3Client } from "@vortex/nexus-api-v3";

import { uploadWithHeaders } from "../../../util/network";
import {
  uploadMultipart,
  uploadSinglePart,
  pollUploadAvailable,
} from "./uploadV3";

const mockUploadWithHeaders = vi.mocked(uploadWithHeaders);

function makeClient(overrides: Partial<NexusV3Client> = {}): NexusV3Client {
  return {
    getUpload: vi.fn(),
    ...overrides,
  } as unknown as NexusV3Client;
}

describe("pollUploadAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("resolves immediately when state is available", async () => {
    const getUpload = vi.fn().mockResolvedValue({ state: "available" });
    const client = makeClient({ getUpload });

    await pollUploadAvailable(client, "upload-123");

    expect(getUpload).toHaveBeenCalledOnce();
    expect(getUpload).toHaveBeenCalledWith("upload-123");
  });

  it("polls until state becomes available", async () => {
    const getUpload = vi
      .fn()
      .mockResolvedValueOnce({ state: "created" })
      .mockResolvedValueOnce({ state: "created" })
      .mockResolvedValueOnce({ state: "available" });

    const client = makeClient({ getUpload });

    const promise = pollUploadAvailable(client, "upload-123");

    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);

    await promise;

    expect(getUpload).toHaveBeenCalledTimes(3);
  });

  it("bails out on a terminal failure state", async () => {
    const getUpload = vi.fn().mockResolvedValue({ state: "failed" });
    const client = makeClient({ getUpload });

    await expect(
      pollUploadAvailable(client, "upload-123"),
    ).rejects.toThrow(/terminal failure state/);
    expect(getUpload).toHaveBeenCalledOnce();
  });
});

describe("uploadSinglePart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls uploadWithHeaders with correct URL and size", async () => {
    mockUploadWithHeaders.mockResolvedValue({
      body: Buffer.alloc(0),
      headers: {},
      statusCode: 200,
    });

    await uploadSinglePart(
      "https://s3.example.com/upload",
      "/tmp/file.zip",
      1024,
    );

    expect(mockUploadWithHeaders).toHaveBeenCalledOnce();
    const [url, , size] = mockUploadWithHeaders.mock.calls[0];
    expect(url).toBe("https://s3.example.com/upload");
    expect(size).toBe(1024);
  });
});

describe("uploadMultipart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("uploads all parts and completes with correct XML", async () => {
    mockUploadWithHeaders
      .mockResolvedValueOnce({
        body: Buffer.alloc(0),
        headers: { etag: '"etag-part-1"' },
        statusCode: 200,
      })
      .mockResolvedValueOnce({
        body: Buffer.alloc(0),
        headers: { etag: '"etag-part-2"' },
        statusCode: 200,
      });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(""),
    } as unknown as Response);

    await uploadMultipart(
      {
        part_size_bytes: 100,
        part_presigned_urls: [
          "https://s3.example.com/part1",
          "https://s3.example.com/part2",
        ],
        complete_presigned_url: "https://s3.example.com/complete",
      },
      "/tmp/bigfile.zip",
      180,
    );

    // Verify both parts were uploaded
    expect(mockUploadWithHeaders).toHaveBeenCalledTimes(2);

    const [url1, , size1] = mockUploadWithHeaders.mock.calls[0];
    expect(url1).toBe("https://s3.example.com/part1");
    expect(size1).toBe(100);

    const [url2, , size2] = mockUploadWithHeaders.mock.calls[1];
    expect(url2).toBe("https://s3.example.com/part2");
    expect(size2).toBe(80); // last part is smaller

    // Verify completion POST with correct XML
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [completeUrl, options] = fetchSpy.mock.calls[0];
    expect(completeUrl).toBe("https://s3.example.com/complete");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/xml" });

    const xml = options.body as string;
    expect(xml).toContain("<CompleteMultipartUpload>");
    expect(xml).toContain("<PartNumber>1</PartNumber>");
    expect(xml).toContain('<ETag>"etag-part-1"</ETag>');
    expect(xml).toContain("<PartNumber>2</PartNumber>");
    expect(xml).toContain('<ETag>"etag-part-2"</ETag>');
  });

  it("throws if a part upload has no ETag", async () => {
    mockUploadWithHeaders.mockResolvedValueOnce({
      body: Buffer.alloc(0),
      headers: {}, // no etag
      statusCode: 200,
    });

    await expect(
      uploadMultipart(
        {
          part_size_bytes: 100,
          part_presigned_urls: ["https://s3.example.com/part1"],
          complete_presigned_url: "https://s3.example.com/complete",
        },
        "/tmp/file.zip",
        50,
      ),
    ).rejects.toThrow("ETag");
  });

  it("throws if multipart completion fails", async () => {
    mockUploadWithHeaders.mockResolvedValueOnce({
      body: Buffer.alloc(0),
      headers: { etag: '"etag-1"' },
      statusCode: 200,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("Internal Server Error"),
    } as unknown as Response);

    await expect(
      uploadMultipart(
        {
          part_size_bytes: 100,
          part_presigned_urls: ["https://s3.example.com/part1"],
          complete_presigned_url: "https://s3.example.com/complete",
        },
        "/tmp/file.zip",
        50,
      ),
    ).rejects.toThrow("Failed to complete multipart upload");
  });
});
