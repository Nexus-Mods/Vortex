/**
 * Multipart upload against the Amazon S3 multipart specification, which the
 * Nexus v3 API's `/uploads/multipart` session is defined in terms of:
 * https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html
 *
 * Each part is PUT to its own presigned URL and answered with an ETag; the
 * session is then closed by POSTing a `CompleteMultipartUpload` document
 * listing those ETags in part order. That protocol — not just the URLs — is
 * what ties this file to S3-compatible storage.
 */
import { UploadError } from "@vortex/shared/errors";

import { log } from "../logging";
import { redactUrl } from "./errors";
import type { UploadOptions, UploadSession } from "./transport";
import { createSession, postBody, putFile } from "./transport";

/** The part layout an S3 multipart session was created with. */
export type S3MultipartLayout = {
  partSizeBytes: number;
  partPresignedUrls: readonly string[];
  completePresignedUrl: string;
};

type PartETag = { partNumber: number; etag: string };

export async function uploadS3Multipart(
  layout: S3MultipartLayout,
  filePath: string,
  fileSize: number,
  options?: UploadOptions,
): Promise<void> {
  const { partSizeBytes, partPresignedUrls, completePresignedUrl } = layout;
  const totalParts = partPresignedUrls.length;
  const expectedParts = Math.ceil(fileSize / partSizeBytes);
  if (expectedParts !== totalParts) {
    throw new UploadError(
      { code: "protocol-violation", url: redactUrl(completePresignedUrl) },
      `Multipart layout mismatch: server returned ${totalParts} presigned URLs ` +
        `but ${fileSize} bytes at ${partSizeBytes} bytes/part needs ${expectedParts}`,
    );
  }

  const session = createSession(options);
  const etags: PartETag[] = [];
  const { onProgress } = options ?? {};

  for (const [index, url] of partPresignedUrls.entries()) {
    const partNumber = index + 1;
    const start = index * partSizeBytes;
    const end = Math.min(start + partSizeBytes, fileSize);

    const response = await putFile(
      session,
      url,
      filePath,
      end - start,
      `part ${partNumber}/${totalParts}`,
      { start, end },
      // Parts run one at a time, so earlier parts are done and this part's
      // count can simply be added to the bytes already behind us.
      onProgress ? (transferred) => onProgress(start + transferred) : undefined,
    );

    const { etag } = response.headers;
    if (!etag) {
      throw new UploadError(
        { code: "protocol-violation", url: redactUrl(url) },
        `Server did not return an ETag for part ${partNumber} of multipart upload`,
      );
    }

    log("debug", "multipart part uploaded", { part: partNumber, total: totalParts, etag });
    etags.push({ partNumber, etag });
  }

  await completeMultipart(session, completePresignedUrl, etags);
}

async function completeMultipart(
  session: UploadSession,
  url: string,
  etags: readonly PartETag[],
): Promise<void> {
  const response = await postBody(
    session,
    url,
    buildCompleteMultipartXml(etags),
    "application/xml",
  );

  // S3 streams the completion response, so a failure that surfaces after the
  // headers were sent arrives as an <Error> document under a 200 status.
  if (response.body.includes("<Error>")) {
    throw new UploadError(
      { code: "protocol-violation", url: redactUrl(url) },
      `Multipart completion reported an error: ${extractS3ErrorCode(response.body) ?? "unknown"}`,
    );
  }
}

function buildCompleteMultipartXml(etags: readonly PartETag[]): string {
  const parts = etags
    .map(
      ({ partNumber, etag }) =>
        `  <Part>\n    <PartNumber>${partNumber}</PartNumber>\n    <ETag>${etag}</ETag>\n  </Part>`,
    )
    .join("\n");
  return `<CompleteMultipartUpload>\n${parts}\n</CompleteMultipartUpload>`;
}

function extractS3ErrorCode(body: string): string | undefined {
  return /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
}
