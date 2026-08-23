import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { gzipSync } from "zlib";

import { afterEach, describe, expect, it } from "vitest";

import { applyChunkMap, safePath } from "./fileOperations";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("safePath", () => {
  it("accepts descendants and rejects paths outside the managed root", () => {
    const root = path.resolve("managed-root");

    expect(safePath(root, path.join("game", "file.exe"))).toBe(path.join(root, "game", "file.exe"));
    expect(() => safePath(root, path.join("..", "outside.exe"))).toThrow("escapes its root");
    expect(() => safePath(root, path.resolve("outside.exe"))).toThrow("Unsafe");
  });
});

describe("applyChunkMap", () => {
  it("streams copied source ranges and literal data into the target", async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "vortex-chunk-map-"));
    temporaryRoots.push(temporaryRoot);
    const source = path.join(temporaryRoot, "source.bin");
    const artifact = path.join(temporaryRoot, "patch.vgcmp.gz");
    const output = path.join(temporaryRoot, "output.bin");
    await fs.writeFile(source, "abcdefghij");

    const copy = Buffer.alloc(13);
    copy[0] = 0x00;
    copy.writeBigUInt64LE(2n, 1);
    copy.writeUInt32LE(4, 9);
    const literal = Buffer.alloc(7);
    literal[0] = 0x01;
    literal.writeUInt32LE(2, 1);
    literal.write("XY", 5);
    const data = Buffer.concat([Buffer.from("VGCMP1\0"), copy, literal, Buffer.from([0xff])]);
    await fs.writeFile(artifact, gzipSync(data));

    await applyChunkMap(source, artifact, output, 6);

    expect(await fs.readFile(output, "utf8")).toBe("cdefXY");
  });

  it("removes incomplete output when an artifact is invalid", async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "vortex-chunk-map-"));
    temporaryRoots.push(temporaryRoot);
    const source = path.join(temporaryRoot, "source.bin");
    const artifact = path.join(temporaryRoot, "patch.vgcmp.gz");
    const output = path.join(temporaryRoot, "output.bin");
    await fs.writeFile(source, "source");
    await fs.writeFile(
      artifact,
      gzipSync(Buffer.concat([Buffer.from("VGCMP1\0"), Buffer.from([0xff])])),
    );

    await expect(applyChunkMap(source, artifact, output, 1)).rejects.toThrow("wrong size");
    await expect(fs.stat(output)).rejects.toThrow();
  });

  it("rejects trailing instructions and removes their output", async () => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "vortex-chunk-map-"));
    temporaryRoots.push(temporaryRoot);
    const source = path.join(temporaryRoot, "source.bin");
    const artifact = path.join(temporaryRoot, "patch.vgcmp.gz");
    const output = path.join(temporaryRoot, "output.bin");
    await fs.writeFile(source, "source");
    const literal = Buffer.alloc(6);
    literal[0] = 0x01;
    literal.writeUInt32LE(1, 1);
    literal[5] = 0x78;
    await fs.writeFile(
      artifact,
      gzipSync(Buffer.concat([Buffer.from("VGCMP1\0"), literal, Buffer.from([0xff, 0xff])])),
    );

    await expect(applyChunkMap(source, artifact, output, 1)).rejects.toThrow("trailing data");
    await expect(fs.stat(output)).rejects.toThrow();
  });
});
