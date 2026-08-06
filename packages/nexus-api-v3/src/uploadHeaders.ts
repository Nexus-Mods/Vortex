/**
 * Headers a v3 upload session's presigned URL covers with its signature.
 */
export type UploadHeaders = {
  contentType: string;
  contentDisposition: string;
};

/**
 * The header values an upload session was presigned with.
 */
export function uploadHeadersFor(filename: string): UploadHeaders {
  return {
    contentType: "application/octet-stream",
    contentDisposition: `attachment; filename="${filename}"`,
  };
}
