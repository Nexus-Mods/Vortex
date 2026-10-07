/** First readable file among `candidates`, or undefined. */
export async function readMergeBase(
  candidates: string[],
  exists: (filePath: string) => Promise<boolean>,
  read: (filePath: string) => Promise<Buffer>,
): Promise<Buffer | undefined> {
  for (const candidate of candidates) {
    if (!(await exists(candidate))) {
      continue;
    }
    try {
      return await read(candidate);
    } catch (err) {
      if ((err as { code?: unknown })?.code !== "ENOENT") {
        throw err;
      }
    }
  }
  return undefined;
}
