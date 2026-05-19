import { isRetryableStatus, withRetry } from "./retry";

interface IPreviewNode {
  path?: string;
  name?: string;
  type?: "directory" | "file";
  size?: string;
  children?: IPreviewNode[];
}

/**
 * CDN fetches are unmetered, so retry faster than the SDK-routed calls in
 * `nexusClient.ts`.
 */
export const CDN_RETRY = { maxAttempts: 4, baseDelayMs: 500, maxDelayMs: 10_000 } as const;

function collectFiles(node: IPreviewNode, out: string[]): void {
  if (node.type === "file" && typeof node.path === "string") {
    out.push(node.path);
    return;
  }
  if (node.children) {
    for (const child of node.children) collectFiles(child, out);
  }
}

/**
 * Marker for HTTP responses that came back with a non-retryable status (404 in
 * practice). Callers can detect this to differentiate "manifest not on CDN"
 * from network failure.
 */
export class FileManifestHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FileManifestHttpError";
  }
}

/**
 * Fetch the archive content-preview JSON from a public Nexus CDN URL and
 * flatten the tree into a list of archive-internal file paths. Retries on
 * transient HTTP / network failures; throws `FileManifestHttpError` on
 * non-retryable HTTP statuses (typically 404 = preview not on CDN).
 */
export async function fetchFileManifest(
  contentPreviewLink: string,
  opts: { maxAttempts?: number } = {},
): Promise<string[]> {
  if (!contentPreviewLink) {
    throw new Error("fetchFileManifest: empty content_preview_link");
  }
  const url = encodeURI(contentPreviewLink);

  const resp = await withRetry(
    async () => {
      const r = await fetch(url);
      if (!r.ok && isRetryableStatus(r.status)) {
        const err = new Error(`HTTP ${r.status}`) as Error & { status: number };
        err.status = r.status;
        throw err;
      }
      return r;
    },
    { ...CDN_RETRY, maxAttempts: opts.maxAttempts ?? CDN_RETRY.maxAttempts },
  );

  if (!resp.ok) {
    throw new FileManifestHttpError(
      `fetchFileManifest: ${url} returned HTTP ${resp.status}`,
      resp.status,
    );
  }

  const tree = (await resp.json()) as IPreviewNode;
  const out: string[] = [];
  collectFiles(tree, out);
  return out;
}
