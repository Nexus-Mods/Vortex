/**
 * A collection knows how big it is before it fetches anything - the sizes ride
 * on its own rules. Checking up front is the difference between "this won't
 * fit" and a half-installed collection the user has to unpick.
 *
 * winapi is stubbed because the volume layout is the thing under test: the
 * download folder, the staging folder and the game can each be on a different
 * drive, and two of them sharing one has to be summed rather than checked twice.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const volumes = new Map<string, { volume: string; free: number }>();

vi.mock("winapi-bindings", () => ({
  GetVolumePathName: (p: string) => {
    const entry = [...volumes.entries()].find(([prefix]) => p.startsWith(prefix));
    if (entry === undefined) throw new Error(`no volume for ${p}`);
    return entry[1].volume;
  },
  GetDiskFreeSpaceEx: (p: string) => {
    const entry = [...volumes.entries()].find(([prefix]) => p.startsWith(prefix));
    if (entry === undefined) throw new Error(`no volume for ${p}`);
    return { freeToCaller: entry[1].free };
  },
}));

import { calculateSpaceRequirement, SPACE_SAFETY_MARGIN } from "./spaceRequirement";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function rule(fileSize: number | undefined, type = "requires") {
  return {
    type,
    reference: { fileSize, logicalFileName: `mod-${fileSize}` },
  } as never;
}

function setVolume(prefix: string, volume: string, free: number) {
  volumes.set(prefix, { volume, free });
}

describe("calculateSpaceRequirement", () => {
  beforeEach(() => {
    volumes.clear();
  });

  it("adds up the archives still to fetch", () => {
    setVolume("D:", "D:\\", 100 * GB);
    setVolume("E:", "E:\\", 100 * GB);

    const res = calculateSpaceRequirement([rule(3 * GB), rule(2 * GB)], {
      downloadPath: "D:\\downloads",
      stagingPath: "E:\\staging",
    });

    expect(res.downloadBytes).toBe(5 * GB);
    expect(res.shortfalls).toEqual([]);
  });

  it("does not re-download an archive that is already there", () => {
    setVolume("D:", "D:\\", 100 * GB);
    setVolume("E:", "E:\\", 100 * GB);

    const res = calculateSpaceRequirement(
      [rule(3 * GB), rule(2 * GB)],
      { downloadPath: "D:\\downloads", stagingPath: "E:\\staging" },
      (r) => (r.reference.fileSize === 3 * GB ? "downloaded" : "missing"),
    );

    expect(res.downloadBytes).toBe(2 * GB);
  });

  // the subtle one: having the archive saves the download, not the unpack
  it("still reserves staging room for an archive that is already downloaded", () => {
    setVolume("D:", "D:\\", 100 * GB);
    setVolume("E:", "E:\\", 100 * GB);

    const res = calculateSpaceRequirement(
      [rule(4 * GB)],
      { downloadPath: "D:\\downloads", stagingPath: "E:\\staging" },
      () => "downloaded",
    );

    expect(res.downloadBytes).toBe(0);
    expect(res.stagingBytes).toBeGreaterThan(0);
  });

  it("asks for nothing for a member that is already installed", () => {
    setVolume("D:", "D:\\", 100 * GB);
    setVolume("E:", "E:\\", 100 * GB);

    const res = calculateSpaceRequirement(
      [rule(4 * GB)],
      { downloadPath: "D:\\downloads", stagingPath: "E:\\staging" },
      () => "installed",
    );

    expect(res.downloadBytes).toBe(0);
    expect(res.stagingBytes).toBe(0);
    expect(res.shortfalls).toEqual([]);
  });

  it("reports a shortfall on the volume that can't take it", () => {
    setVolume("D:", "D:\\", 1 * GB);
    setVolume("E:", "E:\\", 100 * GB);

    const res = calculateSpaceRequirement([rule(8 * GB)], {
      downloadPath: "D:\\downloads",
      stagingPath: "E:\\staging",
    });

    expect(res.shortfalls.map((s) => s.volume)).toEqual(["D:\\"]);
  });

  // the case that makes this worth doing: 10GB free looks fine against a 6GB
  // download and a 6GB unpack taken separately, and isn't
  it("sums both requirements when downloads and staging share a drive", () => {
    setVolume("D:", "D:\\", 10 * GB);

    const res = calculateSpaceRequirement([rule(6 * GB)], {
      downloadPath: "D:\\downloads",
      stagingPath: "D:\\staging",
    });

    expect(res.volumes).toHaveLength(1);
    expect(res.volumes[0].required).toBe(6 * GB + 9 * GB + SPACE_SAFETY_MARGIN);
    expect(res.shortfalls).toHaveLength(1);
  });

  it("keeps headroom rather than filling the drive to the last byte", () => {
    // exactly enough for the payload, nothing spare
    setVolume("D:", "D:\\", 2 * GB);

    const res = calculateSpaceRequirement([rule(1 * GB)], {
      downloadPath: "D:\\downloads",
      stagingPath: "D:\\staging",
    });

    expect(res.shortfalls).toHaveLength(1);
  });

  it("only counts dependency rules", () => {
    setVolume("D:", "D:\\", 100 * GB);

    const res = calculateSpaceRequirement([rule(1 * GB), rule(500 * MB, "conflicts")], {
      downloadPath: "D:\\downloads",
      stagingPath: "D:\\staging",
    });

    expect(res.downloadBytes).toBe(1 * GB);
  });

  it("tolerates rules with no size rather than guessing", () => {
    setVolume("D:", "D:\\", 100 * GB);

    const res = calculateSpaceRequirement([rule(undefined), rule(1 * GB)], {
      downloadPath: "D:\\downloads",
      stagingPath: "D:\\staging",
    });

    expect(res.downloadBytes).toBe(1 * GB);
  });

  // an unreachable drive is not proof of a shortfall - blocking on a guess
  // would be worse than letting the install run and fail honestly
  it("does not claim a shortfall for a volume it cannot query", () => {
    const res = calculateSpaceRequirement([rule(5 * GB)], {
      downloadPath: "Q:\\downloads",
      stagingPath: "Q:\\staging",
    });

    expect(res.shortfalls).toEqual([]);
  });
});
