import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path/win32";

function createArchiveBuffer(hashes: bigint[]): Buffer {
  const tocOffset = 0x28;
  const hashTableOffset = tocOffset + 0x1c;
  const totalSize = hashTableOffset + hashes.length * 0x38;
  const buf = Buffer.alloc(totalSize);

  buf.write("RDAR", 0, "ascii");
  buf.writeUInt32LE(0x0c, 4);
  buf.writeBigUInt64LE(BigInt(tocOffset), 8);
  buf.writeBigUInt64LE(0n, 16);
  buf.writeBigUInt64LE(0n, 24);
  buf.writeBigUInt64LE(BigInt(totalSize), 32);

  buf.write("RDAR", tocOffset, "ascii");
  buf.writeUInt32LE(hashes.length * 0x38, tocOffset + 4);
  buf.writeBigUInt64LE(0n, tocOffset + 8);
  buf.writeUInt32LE(hashes.length, tocOffset + 16);
  buf.writeUInt32LE(0, tocOffset + 20);
  buf.writeUInt32LE(0, tocOffset + 24);

  hashes.forEach((hash, idx) => {
    const entryOffset = hashTableOffset + idx * 0x38;
    buf.writeBigUInt64LE(hash, entryOffset);
  });

  return buf;
}

describe("parseCyberpunkArchive", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "cp77-archive-test-"));
    vi.doMock("../../getVortexPath", () => ({
      getVortexPath: () => dir,
    }));
  });

  afterEach(async () => {
    vi.resetModules();
    vi.doUnmock("../../getVortexPath");
    await rm(dir, { recursive: true, force: true });
  });

  it("extracts stable 64-bit hashes from the archive TOC", async () => {
    const archivePath = path.join(dir, "sample.archive");
    const { parseCyberpunkArchive } = await import("./archiveParser");

    await writeFile(
      archivePath,
      createArchiveBuffer([0x0123456789abcdefn, 0xfedcba9876543210n]),
    );

    const entries = await parseCyberpunkArchive(archivePath);

    expect(entries).toEqual([
      { hash: "0123456789abcdef", mappedName: undefined },
      { hash: "fedcba9876543210", mappedName: undefined },
    ]);
  });

  it("uses the optional hash-name map when one is present", async () => {
    const archivePath = path.join(dir, "mapped.archive");
    const helperDir = path.join(dir, "cp77-archive-helper");

    const { parseCyberpunkArchive, resetCyberpunkArchiveHashMapCache } =
      await import("./archiveParser");

    await writeFile(
      archivePath,
      createArchiveBuffer([0x0123456789abcdefn]),
    );
    await mkdir(helperDir, { recursive: true });
    await writeFile(
      path.join(helperDir, "hash-map.json"),
      JSON.stringify({
        "0123456789abcdef": "base\\gameplay\\items\\legendary.ent",
      }),
      "utf8",
    );

    resetCyberpunkArchiveHashMapCache();
    const entries = await parseCyberpunkArchive(archivePath);

    expect(entries).toEqual([
      {
        hash: "0123456789abcdef",
        mappedName: "base\\gameplay\\items\\legendary.ent",
      },
    ]);
  });
});
