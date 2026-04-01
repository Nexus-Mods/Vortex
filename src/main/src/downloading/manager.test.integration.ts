import { randomBytes } from "node:crypto";
import { readFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { DownloadManager } from "./manager";
import { urlResolver } from "./resolver";
import {
  type TestServer,
  createSharedTestServer,
  serveFile,
  delayAt,
  withHooks,
} from "./test-server";

const LARGE_FILE = randomBytes(20 * 1024 * 1024);
const SMALL_FILE = randomBytes(1024);

let server: TestServer;
let tmpDir: string;

beforeAll(async () => {
  [server, tmpDir] = await Promise.all([
    createSharedTestServer(),
    mkdtemp(path.join(os.tmpdir(), "manager-test-")),
  ]);
});

afterAll(() =>
  Promise.all([server.close(), rm(tmpDir, { recursive: true, force: true })]),
);

let dirCounter = 0;

class TmpDir implements AsyncDisposable {
  constructor(readonly dir: string) {}
  [Symbol.asyncDispose]() {
    return rm(this.dir, { recursive: true, force: true });
  }
}

async function makeTmpDir(): Promise<TmpDir> {
  const dir = path.join(tmpDir, String(++dirCounter));
  await mkdir(dir);
  return new TmpDir(dir);
}

describe("DownloadManager", () => {
  it("downloads a file and resolves the handle promise", async () => {
    using route = server.route(
      serveFile({ body: SMALL_FILE, acceptRanges: false }),
    );
    await using tmp = await makeTmpDir();
    const manager = new DownloadManager(3);
    const dest = path.join(tmp.dir, "output");
    await manager.download(route.url, dest, urlResolver).promise;
    const result = await readFile(dest);
    expect(Buffer.compare(SMALL_FILE, result)).toBe(0);
  });

  it("serializes downloads when concurrency is 1", async () => {
    const completionOrder: number[] = [];
    const files = [randomBytes(1024), randomBytes(1024), randomBytes(1024)];
    const routes = files.map((file) =>
      server.route(serveFile({ body: file, acceptRanges: false })),
    );
    try {
      await using tmp = await makeTmpDir();
      const manager = new DownloadManager(1);
      await Promise.all(
        routes.map(({ url }, i) =>
          manager
            .download(url, path.join(tmp.dir, `file-${i}`), urlResolver)
            .promise.then(() => completionOrder.push(i)),
        ),
      );
      expect(completionOrder).toEqual([0, 1, 2]);
    } finally {
      routes.forEach((r) => r.deregister());
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
      await using tmp = await makeTmpDir();
      const manager = new DownloadManager(3);
      await Promise.all(
        routes.map(
          ({ url }, i) =>
            manager.download(url, path.join(tmp.dir, `file-${i}`), urlResolver)
              .promise,
        ),
      );
      for (const [i, file] of files.entries()) {
        const result = await readFile(path.join(tmp.dir, `file-${i}`));
        expect(Buffer.compare(file, result)).toBe(0);
      }
    } finally {
      routes.forEach((r) => r.deregister());
    }
  });

  it("reports zero progress before the download starts", async () => {
    using route = server.route(
      serveFile({ body: LARGE_FILE, acceptRanges: true }),
    );
    await using tmp = await makeTmpDir();
    const manager = new DownloadManager(3);
    const handle = manager.download(
      route.url,
      path.join(tmp.dir, "output"),
      urlResolver,
    );
    expect(handle.getProgress().bytesReceived).toBe(0);
    await handle.promise;
  });

  it("reports bytesReceived equal to file size on completion", async () => {
    using route = server.route(
      serveFile({ body: LARGE_FILE, acceptRanges: false }),
    );
    await using tmp = await makeTmpDir();
    const manager = new DownloadManager(3);
    const handle = manager.download(
      route.url,
      path.join(tmp.dir, "output"),
      urlResolver,
    );
    await handle.promise;
    expect(handle.getProgress().bytesReceived).toBe(LARGE_FILE.length);
  });

  it("reflects numPending and numRunning correctly", async () => {
    using route = server.route(
      withHooks(
        serveFile({ body: LARGE_FILE, acceptRanges: true }),
        delayAt("onRequest", 100),
      ),
    );
    await using tmp = await makeTmpDir();
    const manager = new DownloadManager(1);

    const h1 = manager.download(
      route.url,
      path.join(tmp.dir, "file-1"),
      urlResolver,
    );
    const h2 = manager.download(
      route.url,
      path.join(tmp.dir, "file-2"),
      urlResolver,
    );

    expect(manager.numRunning).toBe(1);
    expect(manager.numPending).toBe(1);

    await Promise.all([h1.promise, h2.promise]);

    expect(manager.numRunning).toBe(0);
    expect(manager.numPending).toBe(0);
  });
});
