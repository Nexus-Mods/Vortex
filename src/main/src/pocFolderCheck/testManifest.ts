/** Test-only encoder for Steam depot manifests, so tests don't commit third-party files. */

export const MAGIC = {
  payload: 0x71f617d0,
  metadata: 0x1f4812be,
  signature: 0x1b81b817,
  end: 0x32c415ab,
} as const;

export const varint = (n: bigint): Buffer => {
  const out: number[] = [];
  do {
    let b = Number(n & 0x7fn);
    n >>= 7n;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return Buffer.from(out);
};

export const field = (f: number, v: bigint | Buffer | string): Buffer =>
  typeof v === "bigint"
    ? Buffer.concat([varint(BigInt(f << 3)), varint(v)])
    : Buffer.concat([
        varint(BigInt((f << 3) | 2)),
        varint(BigInt(Buffer.from(v).length)),
        Buffer.from(v),
      ]);

export const section = (magic: number, body: Buffer): Buffer => {
  const h = Buffer.alloc(8);
  h.writeUInt32LE(magic, 0);
  h.writeUInt32LE(body.length, 4);
  return Buffer.concat([h, body]);
};

export const end = (): Buffer => {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(MAGIC.end, 0);
  return b;
};

export interface ITestFile {
  name: string;
  size: number;
  flags?: number;
  sha1?: string;
  linkTarget?: string;
}

/** A whole manifest: payload, metadata, end. */
export function buildManifest(
  depotId: number,
  manifestId: string,
  files: ITestFile[],
  encrypted = false,
): Buffer {
  const payload = Buffer.concat(
    files.map((f) =>
      field(
        1,
        Buffer.concat([
          field(1, f.name),
          field(2, BigInt(f.size)),
          field(3, BigInt(f.flags ?? 0)),
          ...(f.sha1 !== undefined ? [field(5, Buffer.from(f.sha1, "hex"))] : []),
          ...(f.linkTarget !== undefined ? [field(7, f.linkTarget)] : []),
        ]),
      ),
    ),
  );
  const metadata = Buffer.concat([
    field(1, BigInt(depotId)),
    field(2, BigInt(manifestId)),
    field(4, encrypted ? 1n : 0n),
  ]);
  return Buffer.concat([section(MAGIC.payload, payload), section(MAGIC.metadata, metadata), end()]);
}
