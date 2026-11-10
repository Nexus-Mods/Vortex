import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { onTestFinished } from "vitest";

/**
 * A fresh directory under the OS temp root, removed when the current test finishes. The path is
 * the long spelling: a folder watcher on a path holding an 8.3 short name (the GitHub Windows
 * runners' RUNNER~1 temp folder) aborts node with a libuv assertion.
 */
export async function makeTempDir(prefix: string): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), prefix)));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** Writes a file at relPath under folder, creating its folders; its content is relPath. */
export async function writeInto(folder: string, relPath: string): Promise<void> {
  const filePath = path.join(folder, relPath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, relPath);
}
