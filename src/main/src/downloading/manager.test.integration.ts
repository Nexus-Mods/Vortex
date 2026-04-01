import { randomBytes } from "node:crypto";
import { readFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { DownloadManager } from "./manager";
import { urlResolver } from "./resolver";
import { type TestServer, createTestServer, serveFile } from "./test-server";

let dirCounter = 0;

async function withTmpDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = path.join(tmpDir, String(++dirCounter));
  await mkdir(dir);
  return fn(dir);
}

const LARGE_FILE = randomBytes(20 * 1024 * 1024);
const SMALL_FILE = randomBytes(1024);

let server: TestServer;
let tmpDir: string;

beforeAll(async () => {
  [server, tmpDir] = await Promise.all([
    createTestServer(({ res }) => {
      res.writeHead(404);
      res.end();
      return Promise.resolve();
    }),
    mkdtemp(path.join(os.tmpdir(), "downloader-test-")),
  ]);
});

afterAll(() =>
  Promise.all([server.close(), rm(tmpDir, { recursive: true, force: true })]),
);

describe("DownloadManager", () => {
  it("downloads a file and resolves the handle promise", async () => {
    const { url, deregister } = server.route(
      serveFile({ body: SMALL_FILE, acceptRanges: false }),
    );
    try {
      await withTmpDir(async (dir) => {
        const manager = new DownloadManager(3);
        const dest = path.join(dir, "output");
        await manager.download(url, dest, urlResolver).promise;
        const result = await readFile(dest);
        expect(Buffer.compare(SMALL_FILE, result)).toBe(0);
      });
    } finally {
      deregister();
    }
  });

  it("serializes downloads when concurrency is 1", async () => {
    const completionOrder: number[] = [];
    const files = [randomBytes(1024), randomBytes(1024), randomBytes(1024)];
    const routes = files.map((file) =>
      server.route(serveFile({ body: file, acceptRanges: false, delayMs: 30 })),
    );

    try {
      await withTmpDir(async (dir) => {
        const manager = new DownloadManager(1);

        await Promise.all(
          routes.map(({ url }, i) =>
            manager
              .download(url, path.join(dir, `file-${i}`), urlResolver)
              .promise.then(() => completionOrder.push(i)),
          ),
        );

        expect(completionOrder).toEqual([0, 1, 2]);
      });
    } finally {
      routes.forEach(({ deregister }) => deregister());
    }
  });

  it("runs multiple downloads concurrently when concurrency allows", async () => {
    const files = Array.from({ length: 6 }, () =>
      randomBytes(20 * 1024 * 1024),
    );
    const routes = files.map((file) =>
      server.route(serveFile({ body: file, acceptRanges: true })),
    );

    try {
      await withTmpDir(async (dir) => {
        const manager = new DownloadManager(3);

        await Promise.all(
          routes.map(
            ({ url }, i) =>
              manager.download(url, path.join(dir, `file-${i}`), urlResolver)
                .promise,
          ),
        );

        for (const [i, file] of files.entries()) {
          const result = await readFile(path.join(dir, `file-${i}`));
          expect(Buffer.compare(file, result)).toBe(0);
        }
      });
    } finally {
      routes.forEach(({ deregister }) => deregister());
    }
  });

  it("reports zero progress before the download starts", async () => {
    const { url, deregister } = server.route(
      serveFile({ body: LARGE_FILE, acceptRanges: true }),
    );
    try {
      await withTmpDir(async (dir) => {
        const manager = new DownloadManager(3);
        const handle = manager.download(
          url,
          path.join(dir, "output"),
          urlResolver,
        );
        expect(handle.getProgress().bytesReceived).toBe(0);
        await handle.promise;
      });
    } finally {
      deregister();
    }
  });

  it("reports bytesReceived equal to file size on completion", async () => {
    const { url, deregister } = server.route(
      serveFile({ body: LARGE_FILE, acceptRanges: false }),
    );
    try {
      await withTmpDir(async (dir) => {
        const manager = new DownloadManager(3);
        const handle = manager.download(
          url,
          path.join(dir, "output"),
          urlResolver,
        );
        await handle.promise;
        expect(handle.getProgress().bytesReceived).toBe(LARGE_FILE.length);
      });
    } finally {
      deregister();
    }
  });

  it("reflects numPending and numRunning correctly", async () => {
    const { url, deregister } = server.route(
      serveFile({ body: LARGE_FILE, acceptRanges: true, delayMs: 100 }),
    );
    try {
      await withTmpDir(async (dir) => {
        const manager = new DownloadManager(1);

        const h1 = manager.download(url, path.join(dir, "file-1"), urlResolver);
        const h2 = manager.download(url, path.join(dir, "file-2"), urlResolver);

        await new Promise((r) => setTimeout(r, 20));
        expect(manager.numRunning).toBe(1);
        expect(manager.numPending).toBe(1);

        await Promise.all([h1.promise, h2.promise]);

        expect(manager.numRunning).toBe(0);
        expect(manager.numPending).toBe(0);
      });
    } finally {
      deregister();
    }
  });
});
