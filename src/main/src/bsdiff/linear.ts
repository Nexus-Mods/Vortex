/**
 * BSDIFF40 patches for files too large for the wasm bsdiff. Its suffix sort needs about
 * 14 bytes of wasm memory per input byte, and wasm memory stops at 4 GiB, so it fails on
 * files of a few hundred MB. This writes a patch without a suffix sort: one control entry
 * per aligned chunk, whose diff bytes are new minus old. In-place edits, which is what
 * curators make to large archives, compress to almost nothing. Content that moved makes a
 * large patch, which scanForDiffs already rejects as too large.
 *
 * The patch is ordinary BSDIFF40, so every Vortex version can apply it. Its three blocks
 * are single bzip2 streams. The wasm exposes bzip2 only through create_patch, so each
 * chunk is compressed there as a one-block stream and the blocks are joined into one
 * stream (Bzip2Joiner).
 */

import * as fs from "node:fs/promises";

import { createPatch, type BsdiffWasmExports } from "./wasm";

// bzip2 level 6 (what the wasm uses) holds 600,000 bytes per block after its first
// run-length pass, which can grow input by 5/4. This size always fits one block.
const CHUNK_SIZE = 450_000;

const BLOCK_MAGIC = 0x314159265359n;
const END_MAGIC = 0x177245385090n;

function readOfft(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 8);
  const value = view.getBigUint64(0, true);
  // BSDIFF40 stores sign-magnitude; the lengths read here are never negative
  return Number(value & 0x7fffffffffffffffn);
}

function offt(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function readBits(buf: Uint8Array, bitPos: number, count: number): bigint {
  let result = 0n;
  for (let i = 0; i < count; ++i) {
    const pos = bitPos + i;
    result = (result << 1n) | BigInt((buf[pos >> 3]! >> (7 - (pos & 7))) & 1);
  }
  return result;
}

interface IBzip2Block {
  stream: Uint8Array;
  startBit: number;
  endBit: number;
  crc: number;
}

/** Compress data (at most CHUNK_SIZE bytes) into one bzip2 block, using the wasm. */
function compressBlock(wasm: BsdiffWasmExports, data: Uint8Array): IBzip2Block {
  // Diffing against an empty file puts all of data in the patch's extra block, which is a
  // bzip2 stream of it
  const patch = createPatch(wasm, new Uint8Array(), data);
  const extraStart = 32 + readOfft(patch, 8) + readOfft(patch, 16);
  const stream = patch.subarray(extraStart);

  // a stream is "BZh" and the level, its blocks, then the end magic, the stream CRC and
  // padding to a byte. The first block starts at byte 4 and opens with its own CRC.
  if (readBits(stream, 32, 48) !== BLOCK_MAGIC) {
    throw new Error("unexpected bzip2 output: no block");
  }
  const crc = Number(readBits(stream, 80, 32));
  const totalBits = stream.length * 8;
  for (let padding = 0; padding < 8; ++padding) {
    const endBit = totalBits - padding - 80;
    if (
      readBits(stream, endBit, 48) === END_MAGIC &&
      Number(readBits(stream, endBit + 48, 32)) === crc
    ) {
      // with exactly one block, the stream CRC equals that block's CRC
      return { stream, startBit: 32, endBit, crc };
    }
  }
  throw new Error("unexpected bzip2 output: not a single block");
}

// a writer's buffer doubles up to this size, then fills further buffers of it, so a large
// stream is never copied whole
const PAGE_SIZE = 16 * 1024 * 1024;

/** Appends bits at any bit offset to growing buffers. */
class BitWriter {
  private mPages: Buffer[] = [];
  private mBuf = Buffer.alloc(4096);
  // bits written to mBuf
  private mBitCount = 0;

  public appendBits(source: Uint8Array, startBit: number, endBit: number): void {
    let pos = startBit;
    for (; pos + 8 <= endBit; pos += 8) {
      const index = pos >> 3;
      const shift = pos & 7;
      const byte =
        shift === 0
          ? source[index]!
          : ((source[index]! << shift) | (source[index + 1]! >> (8 - shift))) & 0xff;
      this.appendByte(byte);
    }
    for (; pos < endBit; ++pos) {
      this.appendValue(BigInt((source[pos >> 3]! >> (7 - (pos & 7))) & 1), 1);
    }
  }

  public appendValue(value: bigint, count: number): void {
    for (let i = count - 1; i >= 0; --i) {
      const bit = Number((value >> BigInt(i)) & 1n);
      this.ensure(1);
      if (bit !== 0) {
        this.mBuf[this.mBitCount >> 3]! |= 0x80 >> (this.mBitCount & 7);
      }
      ++this.mBitCount;
    }
  }

  /** The written bytes, last byte zero-padded, as a list of buffers. */
  public toBuffers(): Buffer[] {
    return [...this.mPages, this.mBuf.subarray(0, (this.mBitCount + 7) >> 3)];
  }

  private appendByte(byte: number): void {
    this.ensure(8);
    const index = this.mBitCount >> 3;
    const shift = this.mBitCount & 7;
    if (shift === 0) {
      this.mBuf[index] = byte;
    } else {
      this.mBuf[index]! |= byte >> shift;
      this.mBuf[index + 1] = (byte << (8 - shift)) & 0xff;
    }
    this.mBitCount += 8;
  }

  private ensure(bits: number): void {
    // one byte to spare: appendByte writes into the byte after the current one
    const needed = ((this.mBitCount + bits + 7) >> 3) + 1;
    if (needed <= this.mBuf.length) {
      return;
    }
    if (this.mBuf.length < PAGE_SIZE) {
      const grown = Buffer.alloc(Math.min(PAGE_SIZE, Math.max(needed, this.mBuf.length * 2)));
      this.mBuf.copy(grown);
      this.mBuf = grown;
    } else {
      // keep the complete bytes, carry a partial last byte over to the next page
      const fullBytes = this.mBitCount >> 3;
      const next = Buffer.alloc(PAGE_SIZE);
      next[0] = this.mBuf[fullBytes]!;
      this.mPages.push(this.mBuf.subarray(0, fullBytes));
      this.mBuf = next;
      this.mBitCount &= 7;
    }
  }
}

/** Joins one-block bzip2 streams into a single bzip2 stream. */
class Bzip2Joiner {
  private mWriter = new BitWriter();
  private mCrc = 0;
  private mPending: Buffer[] = [];
  private mPendingSize = 0;
  private mZeroBlocks = new Map<number, IBzip2Block>();

  constructor(private mWasm: BsdiffWasmExports) {
    this.mWriter.appendBits(Buffer.from("BZh6", "ascii"), 0, 32);
  }

  public write(data: Buffer): void {
    let offset = 0;
    while (offset < data.length) {
      const take = Math.min(CHUNK_SIZE - this.mPendingSize, data.length - offset);
      // copied: callers reuse their buffer for the next read
      this.mPending.push(Buffer.from(data.subarray(offset, offset + take)));
      this.mPendingSize += take;
      offset += take;
      if (this.mPendingSize === CHUNK_SIZE) {
        this.flushChunk();
      }
    }
  }

  public finish(): Buffer[] {
    this.flushChunk();
    this.mWriter.appendValue(END_MAGIC, 48);
    this.mWriter.appendValue(BigInt(this.mCrc), 32);
    return this.mWriter.toBuffers();
  }

  private flushChunk(): void {
    if (this.mPendingSize === 0) {
      return;
    }
    const chunk = Buffer.concat(this.mPending, this.mPendingSize);
    this.mPending = [];
    this.mPendingSize = 0;

    // unchanged regions are runs of zero diff bytes, so most chunks are the same block
    const isZero = chunk.every((byte) => byte === 0);
    let block = isZero ? this.mZeroBlocks.get(chunk.length) : undefined;
    if (block === undefined) {
      block = compressBlock(this.mWasm, chunk);
      if (isZero) {
        this.mZeroBlocks.set(chunk.length, block);
      }
    }

    this.mWriter.appendBits(block.stream, block.startBit, block.endBit);
    // the stream CRC combines the block CRCs in order
    this.mCrc = (((this.mCrc << 1) | (this.mCrc >>> 31)) ^ block.crc) >>> 0;
  }
}

async function readChunk(file: fs.FileHandle, buf: Buffer, position: number): Promise<number> {
  let total = 0;
  while (total < buf.length) {
    const { bytesRead } = await file.read(buf, total, buf.length - total, position + total);
    if (bytesRead === 0) {
      break;
    }
    total += bytesRead;
  }
  return total;
}

/** Create a BSDIFF40 patch file from oldPath and newPath without a suffix sort. */
export async function createLinearPatchFile(
  wasm: BsdiffWasmExports,
  oldPath: string,
  newPath: string,
  patchPath: string,
): Promise<void> {
  let oldFile: fs.FileHandle | undefined;
  let newFile: fs.FileHandle | undefined;
  let patchFile: fs.FileHandle | undefined;
  try {
    oldFile = await fs.open(oldPath, "r");
    newFile = await fs.open(newPath, "r");
    const oldSize = (await oldFile.stat()).size;
    const newSize = (await newFile.stat()).size;
    const shared = Math.min(oldSize, newSize);

    const ctrl = new Bzip2Joiner(wasm);
    const diff = new Bzip2Joiner(wasm);
    const extra = new Bzip2Joiner(wasm);

    const oldBuf = Buffer.alloc(CHUNK_SIZE);
    const newBuf = Buffer.alloc(CHUNK_SIZE);
    for (let pos = 0; pos < shared; pos += CHUNK_SIZE) {
      const len = Math.min(CHUNK_SIZE, shared - pos);
      const oldRead = await readChunk(oldFile, oldBuf.subarray(0, len), pos);
      const newRead = await readChunk(newFile, newBuf.subarray(0, len), pos);
      if (oldRead !== len || newRead !== len) {
        throw new Error("file changed while creating patch");
      }
      for (let i = 0; i < len; ++i) {
        newBuf[i] = (newBuf[i]! - oldBuf[i]!) & 0xff;
      }
      // add len diff bytes to the old data, copy nothing extra, don't seek
      ctrl.write(Buffer.concat([offt(len), offt(0), offt(0)]));
      diff.write(newBuf.subarray(0, len));
    }

    if (newSize > shared) {
      // data past the end of the old file comes from the extra block
      ctrl.write(Buffer.concat([offt(0), offt(newSize - shared), offt(0)]));
      for (let pos = shared; pos < newSize; pos += CHUNK_SIZE) {
        const len = Math.min(CHUNK_SIZE, newSize - pos);
        if ((await readChunk(newFile, newBuf.subarray(0, len), pos)) !== len) {
          throw new Error("file changed while creating patch");
        }
        extra.write(newBuf.subarray(0, len));
      }
    }

    const ctrlBz = ctrl.finish();
    const diffBz = diff.finish();
    const extraBz = extra.finish();
    const byteLength = (bufs: Buffer[]) => bufs.reduce((total, buf) => total + buf.length, 0);
    const header = Buffer.concat([
      Buffer.from("BSDIFF40", "ascii"),
      offt(byteLength(ctrlBz)),
      offt(byteLength(diffBz)),
      offt(newSize),
    ]);
    patchFile = await fs.open(patchPath, "w");
    for (const buf of [header, ...ctrlBz, ...diffBz, ...extraBz]) {
      // writeFile writes all of it, from the current position
      await patchFile.writeFile(buf);
    }
  } finally {
    await Promise.all([oldFile?.close(), newFile?.close(), patchFile?.close()]);
  }
}
