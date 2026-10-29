import type { BigIntStats } from "node:fs";

/**
 * Whether two stats are of the same file. Takes BigInt stats because ReFS file ids exceed 2^53,
 * where neighbouring files get the same plain-number `ino`.
 */
export function isSameFile(lhs: BigIntStats, rhs: BigIntStats): boolean {
  return lhs.ino === rhs.ino && lhs.dev === rhs.dev;
}
