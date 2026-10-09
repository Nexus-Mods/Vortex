import { createHash } from "crypto";
import type { Stats } from "fs";
import fs from "fs/promises";
import path from "path";

import getVortexPath from "@/util/getVortexPath";

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TMP_AGE_MS = 60 * 60 * 1000;
const MAX_BYTES = 200 * 1024 * 1024;

export const previewDir = () => path.join(getVortexPath("temp"), "gamemediapreviews");

export const previewKey = (filePath: string, mtimeMs: number, size: number): string =>
  createHash("sha1").update(`${filePath}:${mtimeMs}:${size}`).digest("hex").slice(0, 16);

export async function prunePreviewCache(): Promise<void> {
  const dir = previewDir();
  const names = await fs.readdir(dir).catch(() => []);
  const now = Date.now();

  const stats = await Promise.all(
    names.map(async (name: string) => {
      const full = path.join(dir, name);
      const s = (await fs.stat(full).catch(() => undefined)) as Stats | undefined;
      return s?.isFile() ? { full, mtimeMs: s.mtimeMs, size: s.size } : undefined;
    }),
  );

  const files = stats.filter((f) => f !== undefined);
  const doomed = files.filter(
    (f) =>
      now - f.mtimeMs > MAX_AGE_MS ||
      (path.extname(f.full) === ".tmp" && now - f.mtimeMs > MAX_TMP_AGE_MS),
  );

  let running = 0;
  const overflow = files
    .filter((f) => now - f.mtimeMs <= MAX_AGE_MS)
    .sort((a, b) => b.mtimeMs - a.mtimeMs) // newest files first
    .filter((f) => (running += f.size) > MAX_BYTES); // everything past the cache size limit

  await Promise.all([...doomed, ...overflow].map((f) => fs.unlink(f.full).catch(() => undefined)));
}
