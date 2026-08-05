/**
 * Minimal recording HTTP server for the upload integration tests. Every
 * request is fully drained before the responder runs, so specs can assert on
 * the exact bytes that arrived.
 */
import http from "node:http";
import type { IncomingHttpHeaders } from "node:http";

export type RecordedRequest = {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

export type Responder = (req: RecordedRequest, res: http.ServerResponse) => void;

/** Responds 200 with an ETag derived from the request path. */
export const respondOk: Responder = (req, res) => {
  res.writeHead(200, { etag: `"etag-${req.url.slice(1)}"` });
  res.end();
};

export type TestServer = {
  readonly baseUrl: string;
  /** Requests recorded since the last {@link reset}. */
  readonly requests: RecordedRequest[];
  /** Replaces the responder used for subsequent requests. */
  respondWith: (responder: Responder) => void;
  /** Clears recorded requests and restores {@link respondOk}. */
  reset: () => void;
  close: () => Promise<void>;
};

export async function createTestServer(): Promise<TestServer> {
  const requests: RecordedRequest[] = [];
  let responder: Responder = respondOk;

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const recorded: RecordedRequest = {
        method: req.method ?? "",
        url: req.url ?? "",
        headers: req.headers,
        body: Buffer.concat(chunks),
      };
      requests.push(recorded);
      responder(recorded, res);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("no server address");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    respondWith: (next) => {
      responder = next;
    },
    reset: () => {
      requests.length = 0;
      responder = respondOk;
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
