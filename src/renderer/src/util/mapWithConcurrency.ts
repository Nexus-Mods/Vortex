/**
 * Map over items with bounded concurrency: at most `concurrency` invocations of `fn` run at once.
 * Results are returned in input order. Uses only native promises.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R> | R,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export default mapWithConcurrency;
