import type { NexusV3Client } from "@vortex/nexus-api-v3";

import { createReadStream } from "fs";

import { log } from "../../../logging";
import { uploadWithHeaders } from "../../../util/network";

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150; // 5 minutes

export async function pollUploadAvailable(
  client: NexusV3Client,
  uploadId: string,
): Promise<void> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    const upload = await client.getUpload(uploadId);
    if (upload.state === "available") {
      return;
    }
    log("debug", "polling upload status", {
      uploadId,
      state: upload.state,
      attempt,
    });
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(
    `Upload ${uploadId} did not become available within ${(POLL_INTERVAL_MS * POLL_MAX_ATTEMPTS) / 1000}s`,
  );
}

export async function uploadSinglePart(
  presignedUrl: string,
  filePath: string,
  fileSize: number,
): Promise<void> {
  await uploadWithHeaders(presignedUrl, createReadStream(filePath), fileSize);
}

function buildCompleteMultipartXml(
  etags: Array<{ partNumber: number; etag: string }>,
): string {
  const parts = etags
    .map(
      ({ partNumber, etag }) =>
        `  <Part>\n    <PartNumber>${partNumber}</PartNumber>\n    <ETag>${etag}</ETag>\n  </Part>`,
    )
    .join("\n");
  return `<CompleteMultipartUpload>\n${parts}\n</CompleteMultipartUpload>`;
}

export async function uploadMultipart(
  multipart: {
    part_size_bytes: number;
    part_presigned_urls: string[];
    complete_presigned_url: string;
  },
  filePath: string,
  fileSize: number,
): Promise<void> {
  const { part_size_bytes, part_presigned_urls, complete_presigned_url } =
    multipart;
  const etags: Array<{ partNumber: number; etag: string }> = [];

  for (let i = 0; i < part_presigned_urls.length; i++) {
    const start = i * part_size_bytes;
    const end = Math.min(start + part_size_bytes, fileSize);
    const chunkSize = end - start;

    const stream = createReadStream(filePath, { start, end: end - 1 });
    const result = await uploadWithHeaders(
      part_presigned_urls[i],
      stream,
      chunkSize,
    );

    const etag = result.headers["etag"];
    if (!etag) {
      throw new Error(
        `S3 did not return an ETag for part ${i + 1} of multipart upload`,
      );
    }

    etags.push({ partNumber: i + 1, etag });
    log("debug", "multipart part uploaded", {
      part: i + 1,
      total: part_presigned_urls.length,
      etag,
    });
  }

  // Complete the multipart upload by POSTing the ETags XML to S3
  const xml = buildCompleteMultipartXml(etags);
  const response = await fetch(complete_presigned_url, {
    method: "POST",
    headers: { "Content-Type": "application/xml" },
    body: xml,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to complete multipart upload: ${response.status} ${body}`,
    );
  }
}
