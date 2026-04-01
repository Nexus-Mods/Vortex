import http from "node:http";

export type RequestContext = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  range: { start: number; end: number } | null;
};

export type RequestHandler = (ctx: RequestContext) => Promise<void>;

export type ServeFileOptions = {
  body: Buffer;
  acceptRanges: boolean;
  delayForGET?: number;
  delayForHEAD?: number;
  etag?: string;
};

export type RecordedRequest = {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  range: { start: number; end: number } | null;
};

export type RouteHandle = {
  url: URL;
  deregister: () => void;
};

export type TestServer = {
  url: URL;
  urlFor: (path: string) => URL;
  route: (handler: RequestHandler) => RouteHandle;
  setHandler: (handler: RequestHandler) => void;
  requests: RecordedRequest[];
  close: () => Promise<void>;
};

export async function createTestServer(
  initialHandler: RequestHandler,
): Promise<TestServer> {
  let handler = initialHandler;
  const requests: RecordedRequest[] = [];
  const routes = new Map<string, RequestHandler>();
  let routeCounter = 0;

  const server = http.createServer((req, res) => {
    const range = parseRange(req.headers["range"]);
    const pathname = req.url ?? "/";

    requests.push({
      method: req.method ?? "GET",
      url: pathname,
      headers: req.headers,
      range,
    });

    const routeHandler = routes.get(pathname);
    const dispatch = routeHandler ?? handler;

    dispatch({ req, res, range }).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(500);
        if (err instanceof Error) {
          res.end(String(err));
        } else if (typeof err === "string") {
          res.end(err);
        }
      }
    });
  });

  const url = await listen(server);

  return {
    url,
    urlFor: (p) => new URL(p, url),
    route(routeHandler) {
      const path = `/_route/${++routeCounter}`;
      routes.set(path, routeHandler);
      return {
        url: new URL(path, url),
        deregister: () => routes.delete(path),
      };
    },
    requests,
    setHandler: (h) => (handler = h),
    close: () => close(server),
  };
}

/**
 * Convenience wrapper that ensures the server is always closed, even if the
 * test throws.
 */
export async function withTestServer(
  initialHandler: RequestHandler,
  fn: (server: TestServer) => Promise<void>,
): Promise<void> {
  const server = await createTestServer(initialHandler);
  try {
    await fn(server);
  } finally {
    await server.close();
  }
}

/** Serves a buffer, optionally supporting range requests */
export function serveFile(opts: ServeFileOptions): RequestHandler {
  const { body, acceptRanges, delayForGET = 0, delayForHEAD = 0, etag } = opts;

  return async ({ req, res, range }) => {
    if (req.method === "GET" && delayForGET > 0) {
      await new Promise((r) => setTimeout(r, delayForGET));
    }

    if (req.method === "HEAD" && delayForHEAD > 0) {
      await new Promise((r) => setTimeout(r, delayForHEAD));
    }

    // Enforce If-Match if the request includes it and we have an etag
    const ifMatch = req.headers["if-match"];
    if (ifMatch && etag && ifMatch !== etag) {
      res.writeHead(412);
      res.end();
      return;
    }

    const headers: http.OutgoingHttpHeaders = {};

    if (acceptRanges) {
      headers["accept-ranges"] = "bytes";
    }

    if (etag) {
      headers["etag"] = etag;
    }

    if (range && acceptRanges) {
      const slice = body.subarray(range.start, range.end + 1);
      res.writeHead(206, {
        ...headers,
        "content-length": slice.length,
        "content-range": `bytes ${range.start}-${range.end}/${body.length}`,
      });
      res.end(slice);
    } else {
      res.writeHead(200, {
        ...headers,
        "content-length": body.length,
      });
      res.end(body);
    }
  };
}

/**
 * Routes requests to different handlers based on URL path. Useful for testing
 * resolvers that return different URLs for probe vs chunk requests.
 */
export function serveRoutes(
  routes: Record<string, RequestHandler>,
): RequestHandler {
  return (ctx) => {
    const pathname = ctx.req.url ?? "/";
    const handler = routes[pathname];
    if (!handler) {
      ctx.res.writeHead(404);
      ctx.res.end();
      return Promise.resolve();
    }
    return handler(ctx);
  };
}

/** Responds with a fixed HTTP status code and no body */
export function serveStatus(statusCode: number): RequestHandler {
  return ({ res }) => {
    res.writeHead(statusCode);
    res.end();
    return Promise.resolve();
  };
}

/**
 * Writes part of the response body then abruptly destroys the socket,
 * simulating a dropped connection mid-transfer.
 */
export function serveTruncated(
  body: Buffer,
  bytesBeforeDrop: number,
): RequestHandler {
  return ({ res }) => {
    res.writeHead(200, { "content-length": body.length });
    res.write(body.subarray(0, bytesBeforeDrop));
    res.socket?.destroy();
    return Promise.resolve();
  };
}

/**
 * Responds successfully for the first `n` requests, then switches to a
 * different handler. Useful for simulating transient failures.
 */
export function failAfter(
  successCount: number,
  opts: {
    success: RequestHandler;
    failure: RequestHandler;
  },
): RequestHandler {
  let count = 0;
  return (ctx) => {
    count++;
    return count <= successCount ? opts.success(ctx) : opts.failure(ctx);
  };
}

/**
 * Fails for the first `n` requests, then switches to a success handler.
 * Useful for testing retry logic.
 */
export function failFirst(
  failureCount: number,
  opts: {
    success: RequestHandler;
    failure: RequestHandler;
  },
): RequestHandler {
  return failAfter(failureCount, {
    success: opts.failure,
    failure: opts.success,
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function listen(server: http.Server): Promise<URL> {
  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Unexpected server address"));
        return;
      }
      resolve(new URL(`http://127.0.0.1:${addr.port}`));
    });
  });
}

function parseRange(
  header: string | undefined,
): { start: number; end: number } | null {
  if (!header) return null;
  const match = header.match(/^bytes=(\d+)-(\d+)$/);
  if (!match) return null;
  return { start: parseInt(match[1], 10), end: parseInt(match[2], 10) };
}
