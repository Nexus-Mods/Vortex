import type { BigIntStats } from "node:fs";
import { lstat as lstatPromise, stat as statPromise } from "node:fs/promises";

import PromiseBB from "bluebird";

/**
 * Whether two stats are of the same file. Takes BigInt stats because ReFS file ids exceed 2^53,
 * where neighbouring files get the same plain-number `ino`.
 */
export function isSameFile(lhs: BigIntStats, rhs: BigIntStats): boolean {
  return lhs.ino === rhs.ino && lhs.dev === rhs.dev;
}

export function statBigIntAsync(filePath: string): PromiseBB<BigIntStats> {
  return PromiseBB.resolve(statPromise(filePath, { bigint: true }));
}

export function lstatBigIntAsync(filePath: string): PromiseBB<BigIntStats> {
  return PromiseBB.resolve(lstatPromise(filePath, { bigint: true }));
}
