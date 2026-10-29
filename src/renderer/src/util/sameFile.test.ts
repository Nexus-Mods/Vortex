import type { BigIntStats } from "node:fs";

import { describe, expect, it } from "vitest";

import { isSameFile } from "./sameFile";

const stats = (ino: bigint, dev: bigint) => ({ ino, dev }) as BigIntStats;

describe("isSameFile", () => {
  it("tells apart neighbouring ReFS ids that are equal as numbers", () => {
    const lhs = 6917529027680459906n;
    const rhs = 6917529027680459907n;
    expect(Number(lhs)).toBe(Number(rhs));
    expect(isSameFile(stats(lhs, 1n), stats(rhs, 1n))).toBe(false);
    expect(isSameFile(stats(lhs, 1n), stats(lhs, 1n))).toBe(true);
  });

  it("doesn't match equal ids on different volumes", () => {
    expect(isSameFile(stats(5n, 1n), stats(5n, 2n))).toBe(false);
  });
});
