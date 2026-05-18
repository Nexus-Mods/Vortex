import http from "node:http";

// ---------------------------------------------------------------------------
// Range types
// ---------------------------------------------------------------------------

export type Range =
  | { kind: "bounded"; start: number; end: number }
  | { kind: "from"; start: number }
  | { kind: "suffix"; length: number }
  | { kind: "multi"; ranges: Array<{ start: number; end: number }> };

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

/**
 * Fine-grained interception points in a request's lifecycle. Every hook is
 * optional. Async hooks are awaited before the pipeline continues.
 *
 * Throwing `Abort` inside any hook immediately destroys the socket.
 *
 * @example
 * server.route(withHooks(serveFile({ body }), mergeHooks(
 *   delayAt("afterHeaders", 100),
 *   abortBeforeChunk(3),
 * )));
 */
export type LifecycleHooks = {
  onRequest?: (ctx: RequestContext) => void | Promise<void>;
  beforeHeaders?: (
    ctx: RequestContext,
    status: number,
    headers: http.OutgoingHttpHeaders,
  ) => void | Promise<void>;
  afterHeaders?: (ctx: RequestContext) => void | Promise<void>;
  beforeChunk?: (ctx: RequestContext, info: ChunkInfo) => void | Promise<void>;
  afterChunk?: (ctx: RequestContext, info: ChunkInfo) => void | Promise<void>;
  onFinish?: (ctx: RequestContext) => void | Promise<void>;
};

export type ChunkInfo = {
  /** 0-based chunk index. */
  index: number;
  bytes: Buffer;
};

/**
 * Throw inside any hook to immediately destroy the socket, simulating a
 * dropped connection at that exact point in the lifecycle.
 */
export class Abort extends Error {
  constructor(message = "Aborted by lifecycle hook") {
    super(message);
    this.name = "Abort";
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export type Next = () => Promise<void>;

/**
 * A middleware receives the request context and a `next` function. Call
 * `next()` to continue the pipeline, or skip it to short-circuit.
 *
 * @example
 * const requireAuth: Middleware = async (ctx, next) => {
 *   if (!ctx.req.headers["x-api-key"]) {
 *     ctx.res.writeHead(401); ctx.res.end(); return;
 *   }
 *   await next();
 * };
 */
export type Middleware = (ctx: RequestContext, next: Next) => Promise<void>;

// ---------------------------------------------------------------------------
// Request / response context
// ---------------------------------------------------------------------------

export type RecordedRequest = {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  range: Range | null;
  receivedAt: number;
};

export type RecordedResponse = {
  status: number;
  headers: http.OutgoingHttpHeaders;
};

export type RouteRecord = {
  requests: RecordedRequest[];
  responses: RecordedResponse[];
  waiters: Array<{ count: number; resolve: (r: RecordedRequest[]) => void }>;
};

export type RequestContext = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  range: Range | null;
  hooks: LifecycleHooks;
  route: RouteRecord;
};

export type RequestHandler = (ctx: RequestContext) => Promise<void>;

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

/**
 * A handle returned by `server.route()`. Contains the unique URL for this
 * route and per-route request/response records.
 *
 * Routes live until `deregister()` is called — typically in `afterEach`.
 *
 * @example
 * let route: RouteHandle;
 * afterEach(() => route.deregister());
 *
 * test("retries on 503", async () => {
 *   const { handler } = failFirst(2, { failure: serveStatus(503), success: serveFile({ body }) });
 *   route = server.route(handler);
 *   // client can hit route.url as many times as needed
 * });
 */
export type RouteHandle = {
  url: URL;
  requests: RecordedRequest[];
  responses: RecordedResponse[];
  /** Resolves once at least `count` requests have been received on this route. */
  waitForRequests: (count: number) => Promise<RecordedRequest[]>;
  /** Remove the route. Called automatically when used with `using`. */
  deregister: () => void;
  [Symbol.dispose]: () => void;
};

export type TestServer = {
  url: URL;
  urlFor: (path: string) => URL;
  /**
   * Register a handler on an auto-generated unique path. The returned handle
   * contains the URL and per-route request/response records. Call
   * `deregister()` in `afterEach` to remove the route after the test.
   */
  route: (handler: RequestHandler) => RouteHandle;
  /**
   * Push middleware onto the global stack. Runs for every request before the
   * route handler. Returns a function to remove it.
   */
  use: (middleware: Middleware) => () => void;
  close: () => Promise<void>;
};

export async function createTestServer(): Promise<TestServer> {
  const routes = new Map<string, { handler: RequestHandler; record: RouteRecord }>();
  const middlewares: Middleware[] = [];
  let routeCounter = 0;

  const server = http.createServer((req, res) => {
    const range = parseRange(req.headers["range"]);
    const pathname = req.url ?? "/";
    const entry = routes.get(pathname);

    if (!entry) {
      res.writeHead(404);
      res.end();
      return;
    }

    const recorded: RecordedRequest = {
      method: req.method ?? "GET",
      url: pathname,
      headers: req.headers,
      range,
      receivedAt: Date.now(),
    };
    entry.record.requests.push(recorded);
    entry.record.waiters
      .splice(0)
      .forEach(
        (w) => entry.record.requests.length >= w.count && w.resolve(entry.record.requests.slice()),
      );

    const ctx: RequestContext = {
      req,
      res,
      range,
      hooks: {},
      route: entry.record,
    };
    const pipeline = [...middlewares].reduceRight<Next>(
      (next, mw) => () => mw(ctx, next),
      () => entry.handler(ctx),
    );

    pipeline().catch((err) => {
      if (err instanceof Abort) {
        res.socket?.destroy();
        return;
      }
      if (!res.headersSent) {
        res.writeHead(500);
        res.end(err instanceof Error ? String(err) : "Internal error");
      }
    });
  });

  const url = await listen(server);

  return {
    url,
    urlFor: (p) => new URL(p, url),
    route(routeHandler) {
      const path = `/_route/${++routeCounter}`;
      const record: RouteRecord = { requests: [], responses: [], waiters: [] };
      routes.set(path, { handler: routeHandler, record });
      return {
        url: new URL(path, url),
        requests: record.requests,
        responses: record.responses,
        waitForRequests(count) {
          if (record.requests.length >= count) return Promise.resolve(record.requests.slice());
          return new Promise((resolve) => record.waiters.push({ count, resolve }));
        },
        deregister: () => routes.delete(path),
        [Symbol.dispose]() {
          routes.delete(path);
        },
      };
    },
    use(middleware) {
      middlewares.push(middleware);
      return () => middlewares.splice(middlewares.indexOf(middleware), 1);
    },
    close: () => closeServer(server),
  };
}

/**
 * Creates a shared server instance intended to be used across an entire test
 * suite. Callers are responsible for calling `close()` in the suite teardown.
 *
 * @example
 * const server = await createSharedTestServer();
 * afterAll(() => server.close());
 *
 * test("retries on 503", async () => {
 *   const { handler } = failFirst(2, { failure: serveStatus(503), success: serveFile({ body }) });
 *   const route = server.route(handler);
 *   afterEach(() => route.deregister());
 * });
 */
export async function createSharedTestServer(): Promise<TestServer> {
  return createTestServer();
}

// ---------------------------------------------------------------------------
// Instrumented response writer
// ---------------------------------------------------------------------------

export type WriteBodyOptions = {
  /** A single Buffer is one chunk; an array produces multiple chunks. */
  body?: Buffer | Buffer[];
};

/**
 * Writes headers and body through the lifecycle hook pipeline. All built-in
 * handlers go through this — custom handlers should too for hook support.
 */
export async function writeResponse(
  ctx: RequestContext,
  status: number,
  headers: http.OutgoingHttpHeaders,
  opts: WriteBodyOptions = {},
): Promise<void> {
  const { hooks, res } = ctx;

  await hooks.beforeHeaders?.(ctx, status, headers);
  res.writeHead(status, headers);
  ctx.route.responses.push({ status, headers });
  await hooks.afterHeaders?.(ctx);

  if (opts.body) {
    const chunks = Buffer.isBuffer(opts.body) ? [opts.body] : opts.body;
    for (let i = 0; i < chunks.length; i++) {
      const info: ChunkInfo = { index: i, bytes: chunks[i] };
      await hooks.beforeChunk?.(ctx, info);
      res.write(info.bytes);
      await hooks.afterChunk?.(ctx, info);
    }
  }

  res.end();
  await hooks.onFinish?.(ctx);
}

// ---------------------------------------------------------------------------
// File / body handlers
// ---------------------------------------------------------------------------

export type ServeFileOptions = {
  body: Buffer;
  acceptRanges?: boolean;
  headers?: http.OutgoingHttpHeaders;
  etag?: string;
  /**
   * If set, the body is split into chunks of this size. Each chunk passes
   * through `beforeChunk` / `afterChunk` hooks, making timing and mid-transfer
   * aborts controllable. If unset, the body is written in a single chunk.
   */
  chunkSize?: number;
};

export function serveFile(opts: ServeFileOptions): RequestHandler {
  const { body, acceptRanges = false, headers: extraHeaders = {}, etag, chunkSize } = opts;

  const toChunks = (buf: Buffer): Buffer | Buffer[] => {
    if (!chunkSize) return buf;
    const chunks: Buffer[] = [];
    for (let offset = 0; offset < buf.length; offset += chunkSize) {
      chunks.push(buf.subarray(offset, offset + chunkSize));
    }
    return chunks;
  };

  return async (ctx) => {
    await ctx.hooks.onRequest?.(ctx);

    const ifMatch = ctx.req.headers["if-match"];
    if (ifMatch && etag && ifMatch !== etag) {
      await writeResponse(ctx, 412, extraHeaders);
      return;
    }

    const baseHeaders: http.OutgoingHttpHeaders = {
      ...extraHeaders,
      ...(acceptRanges && { "accept-ranges": "bytes" }),
      ...(etag && { etag }),
    };

    if (ctx.req.method === "HEAD") {
      await writeResponse(ctx, 200, {
        ...baseHeaders,
        "content-length": body.length,
      });
      return;
    }

    if (ctx.range && acceptRanges) {
      const resolved = resolveRange(ctx.range, body.length);
      if (!resolved) {
        await writeResponse(ctx, 416, {
          "content-range": `bytes */${body.length}`,
        });
        return;
      }
      const slice = body.subarray(resolved.start, resolved.end + 1);
      await writeResponse(
        ctx,
        206,
        {
          ...baseHeaders,
          "content-length": slice.length,
          "content-range": `bytes ${resolved.start}-${resolved.end}/${body.length}`,
        },
        { body: toChunks(slice) },
      );
    } else {
      await writeResponse(
        ctx,
        200,
        { ...baseHeaders, "content-length": body.length },
        { body: toChunks(body) },
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Simple status handlers
// ---------------------------------------------------------------------------

export function serveStall(): RequestHandler {
  return () =>
    new Promise(() => {
      /* never resolves */
    });
}

export function serveStatus(
  statusCode: number,
  headers?: http.OutgoingHttpHeaders,
): RequestHandler {
  return (ctx) => writeResponse(ctx, statusCode, headers ?? {});
}

export function serveDropConnection(): RequestHandler {
  return ({ res }) => {
    res.socket?.destroy();
    return Promise.resolve();
  };
}

export function serveTruncated(body: Buffer, bytesBeforeDrop: number): RequestHandler {
  return (ctx) => {
    ctx.res.writeHead(200, { "content-length": body.length });
    ctx.res.write(body.subarray(0, bytesBeforeDrop));
    ctx.res.socket?.destroy();
    return Promise.resolve();
  };
}

// ---------------------------------------------------------------------------
// Middleware helpers
// ---------------------------------------------------------------------------

export function connectionClose(): Middleware {
  return (ctx, next) => {
    ctx.res.setHeader("connection", "close");
    return next();
  };
}

export function injectHeaders(headers: http.OutgoingHttpHeaders): Middleware {
  return (ctx, next) => {
    for (const [k, v] of Object.entries(headers)) ctx.res.setHeader(k, v as string);
    return next();
  };
}

export function requireHeaders(required: Record<string, string | RegExp>): Middleware {
  return (ctx, next) => {
    for (const [name, expected] of Object.entries(required)) {
      const actual = ctx.req.headers[name.toLowerCase()];
      const ok =
        typeof expected === "string"
          ? actual === expected
          : typeof actual === "string" && expected.test(actual);
      if (!ok) {
        ctx.res.writeHead(400, { "x-missing-header": name });
        ctx.res.end();
        return Promise.resolve();
      }
    }
    return next();
  };
}

// ---------------------------------------------------------------------------
// Lifecycle hook factories
// ---------------------------------------------------------------------------

export function delayAt(
  point: keyof Omit<LifecycleHooks, "beforeChunk" | "afterChunk">,
  ms: number,
): LifecycleHooks {
  return { [point]: () => delay(ms) };
}

export function delayBeforeChunk(targetIndex: number, ms: number): LifecycleHooks {
  return {
    beforeChunk: (_, { index }) => (index === targetIndex ? delay(ms) : undefined),
  };
}

export function abortAt(
  point: keyof Omit<LifecycleHooks, "beforeChunk" | "afterChunk">,
): LifecycleHooks {
  return {
    [point]: () => {
      throw new Abort();
    },
  };
}

export function abortBeforeChunk(targetIndex: number): LifecycleHooks {
  return {
    beforeChunk: (_, { index }) => {
      if (index === targetIndex) throw new Abort();
    },
  };
}

export function mergeHooks(...hookSets: LifecycleHooks[]): LifecycleHooks {
  const pick = <K extends keyof LifecycleHooks>(point: K): NonNullable<LifecycleHooks[K]>[] =>
    hookSets.map((h) => h[point]).filter((f): f is NonNullable<LifecycleHooks[K]> => f != null);

  const fns = {
    onRequest: pick("onRequest"),
    beforeHeaders: pick("beforeHeaders"),
    afterHeaders: pick("afterHeaders"),
    beforeChunk: pick("beforeChunk"),
    afterChunk: pick("afterChunk"),
    onFinish: pick("onFinish"),
  };

  return {
    onRequest: fns.onRequest.length
      ? async (ctx) => {
          for (const fn of fns.onRequest) await fn(ctx);
        }
      : undefined,
    beforeHeaders: fns.beforeHeaders.length
      ? async (ctx, s, h) => {
          for (const fn of fns.beforeHeaders) await fn(ctx, s, h);
        }
      : undefined,
    afterHeaders: fns.afterHeaders.length
      ? async (ctx) => {
          for (const fn of fns.afterHeaders) await fn(ctx);
        }
      : undefined,
    beforeChunk: fns.beforeChunk.length
      ? async (ctx, info) => {
          for (const fn of fns.beforeChunk) await fn(ctx, info);
        }
      : undefined,
    afterChunk: fns.afterChunk.length
      ? async (ctx, info) => {
          for (const fn of fns.afterChunk) await fn(ctx, info);
        }
      : undefined,
    onFinish: fns.onFinish.length
      ? async (ctx) => {
          for (const fn of fns.onFinish) await fn(ctx);
        }
      : undefined,
  };
}

export function withHooks(handler: RequestHandler, hooks: LifecycleHooks): RequestHandler {
  return (ctx) => {
    ctx.hooks = mergeHooks(ctx.hooks, hooks);
    return handler(ctx);
  };
}

// ---------------------------------------------------------------------------
// Fault injection
// ---------------------------------------------------------------------------

export type FailHandle = {
  handler: RequestHandler;
  reset: () => void;
};

export function failAfter(
  successCount: number,
  opts: { success: RequestHandler; failure: RequestHandler },
): FailHandle {
  let count = 0;
  return {
    handler: (ctx) => (++count <= successCount ? opts.success(ctx) : opts.failure(ctx)),
    reset: () => {
      count = 0;
    },
  };
}

export function failFirst(
  failureCount: number,
  opts: { success: RequestHandler; failure: RequestHandler },
): FailHandle {
  return failAfter(failureCount, {
    success: opts.failure,
    failure: opts.success,
  });
}

export function failEveryNth(
  n: number,
  opts: { success: RequestHandler; failure: RequestHandler },
): FailHandle {
  let count = 0;
  return {
    handler: (ctx) => (++count % n === 0 ? opts.failure(ctx) : opts.success(ctx)),
    reset: () => {
      count = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
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

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRange(header: string | undefined): Range | null {
  if (!header) return null;
  const value = header.replace(/^bytes=/, "");
  const parts = value.split(",").map((s) => s.trim());

  if (parts.length > 1) {
    const ranges: Array<{ start: number; end: number }> = [];
    for (const part of parts) {
      const m = part.match(/^(\d+)-(\d+)$/);
      if (!m) return null;
      ranges.push({ start: parseInt(m[1], 10), end: parseInt(m[2], 10) });
    }
    return { kind: "multi", ranges };
  }

  const bounded = value.match(/^(\d+)-(\d+)$/);
  if (bounded)
    return {
      kind: "bounded",
      start: parseInt(bounded[1], 10),
      end: parseInt(bounded[2], 10),
    };

  const from = value.match(/^(\d+)-$/);
  if (from) return { kind: "from", start: parseInt(from[1], 10) };

  const suffix = value.match(/^-(\d+)$/);
  if (suffix) return { kind: "suffix", length: parseInt(suffix[1], 10) };

  return null;
}

function resolveRange(range: Range, totalLength: number): { start: number; end: number } | null {
  if (range.kind === "bounded") {
    if (range.start >= totalLength) return null;
    return { start: range.start, end: Math.min(range.end, totalLength - 1) };
  }
  if (range.kind === "from") {
    if (range.start >= totalLength) return null;
    return { start: range.start, end: totalLength - 1 };
  }
  if (range.kind === "suffix") {
    return {
      start: Math.max(0, totalLength - range.length),
      end: totalLength - 1,
    };
  }
  if (range.kind === "multi" && range.ranges.length > 0) {
    return resolveRange({ kind: "bounded", ...range.ranges[0] }, totalLength);
  }
  return null;
}
