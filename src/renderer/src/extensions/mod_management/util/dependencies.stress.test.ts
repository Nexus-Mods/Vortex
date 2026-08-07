/**
 * Stress coverage for the dependency-matching hot path that OOMed the renderer on very
 * large collections (~2850 required mods matched against ~3000 local archives - see the
 * Cyberpunk 2077 "p0qfwm" crash loop). Simulates that shape synthetically: every
 * reference is probed against every download (O(refs x downloads), ~9 million probes)
 * and asserts that peak heap growth stays bounded - which it only does with the
 * per-download lookup memoization in dependencies.ts.
 */
import { describe, expect, it, vi } from "vitest";

import { makeDownload } from "../../../test-utils/builders";
import type { IDownload } from "../../../types/IState";
import type { IModReference } from "../types/IMod";
import { findDownloadByRef, lookupFromDownload } from "./dependencies";

vi.mock("../../../util/log", () => ({ log: vi.fn() }));
// native module pulled in transitively via util/selectors; not exercised by these tests
vi.mock("winapi-bindings", () => ({ default: {} }));

const COUNT = 3000;
const GAME = "cyberpunk2077";

function makeFixture() {
  const downloads: { [dlId: string]: IDownload } = {};
  const references: IModReference[] = [];
  for (let i = 0; i < COUNT; ++i) {
    downloads[`dl-${i}`] = makeDownload({
      id: `dl-${i}`,
      state: "finished",
      game: [GAME],
      localPath: `mod-${i}.zip`,
      size: 1000 + i,
      fileMD5: `md5-${i}`,
      modInfo: {
        version: "1.0.0",
        name: `Mod ${i}`,
        referenceTag: `tag-${i}`,
      },
    });
    references.push({
      tag: `tag-${i}`,
      gameId: GAME,
      fileMD5: `md5-${i}`,
      fileSize: 1000 + i,
    } as IModReference);
  }
  return { downloads, references };
}

function heapUsed(): number {
  if (typeof global.gc === "function") {
    global.gc();
  }
  return process.memoryUsage().heapUsed;
}

describe("dependency matching at collection scale", () => {
  it(`matches ${COUNT} references against ${COUNT} downloads with bounded heap growth`, () => {
    const { downloads, references } = makeFixture();

    // warm the per-download caches once so the measurement below reflects the
    // steady-state cost of re-matching (what the install pipeline actually does
    // repeatedly: gather, requeue scans, poll ticks)
    Object.values(downloads).forEach((dl) => lookupFromDownload(dl));

    const before = heapUsed();

    let matched = 0;
    for (const ref of references) {
      if (findDownloadByRef(ref, downloads) !== undefined) {
        ++matched;
      }
    }

    const after = heapUsed();
    const growthMB = (after - before) / (1024 * 1024);

    process.stdout.write(
      `[stress] ${COUNT}x${COUNT} matching: heap growth ${growthMB.toFixed(1)} MB\n`,
    );

    expect(matched).toBe(COUNT);
    // generous bound: without memoization this run allocates hundreds of MB of
    // throw-away lookup objects; with it, growth stays in the low tens of MB
    expect(growthMB).toBeLessThan(192);
  }, 120_000);

  it("returns identity-stable lookup info across repeated probes", () => {
    const { downloads } = makeFixture();
    const values = Object.values(downloads);
    for (const dl of values) {
      expect(lookupFromDownload(dl)).toBe(lookupFromDownload(dl));
    }
  });
});
