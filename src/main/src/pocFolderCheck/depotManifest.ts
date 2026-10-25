/**
 * Dev-only PoC: reads a Steam depot manifest (`<steam>/depotcache/<depot>_<manifest>.manifest`),
 * the per-depot list of files Steam installed with their sizes and SHA1s. The format is a run of
 * sections, each a uint32le magic, a uint32le length and a protobuf body. See
 * docs/superpowers/specs/2026-10-25-steam-game-folder-check-poc-design.md.
 */

export interface IDepotFile {
  /** Path relative to the game folder, with Steam's spelling and Windows separators */
  name: string;
  size: number;
  flags: number;
  /** Lowercase hex, or "" when the manifest has none */
  sha1: string;
  linkTarget: string;
}

export interface IDepotManifest {
  depotId: number;
  /** Decimal string; manifest ids overflow a JS number */
  manifestId: string;
  filenamesEncrypted: boolean;
  files: IDepotFile[];
}

export const DEPOT_FLAG = {
  userConfig: 1,
  versionedUserConfig: 2,
  directory: 64,
  symlink: 512,
} as const;

const MAGIC_PAYLOAD = 0x71f617d0;
const MAGIC_METADATA = 0x1f4812be;
const MAGIC_SIGNATURE = 0x1b81b817;
const MAGIC_END = 0x32c415ab;

type FieldValue = bigint | Buffer;

function invalid(reason: string): Error {
  return new Error(`invalid depot manifest: ${reason}`);
}

/** Splits a protobuf message into (field number, value) pairs. */
function* fields(data: Buffer): Generator<[number, FieldValue]> {
  let offset = 0;
  const varint = (): bigint => {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      if (offset >= data.length) throw invalid("varint runs past the end");
      const byte = data[offset++];
      result |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return result;
      shift += 7n;
    }
  };
  const take = (length: number): Buffer => {
    if (offset + length > data.length) throw invalid("field runs past the end");
    const slice = data.subarray(offset, offset + length);
    offset += length;
    return slice;
  };

  while (offset < data.length) {
    const key = Number(varint());
    const fieldNumber = key >> 3;
    switch (key & 7) {
      case 0:
        yield [fieldNumber, varint()];
        break;
      case 1:
        yield [fieldNumber, take(8)];
        break;
      case 2:
        yield [fieldNumber, take(Number(varint()))];
        break;
      case 5:
        yield [fieldNumber, take(4)];
        break;
      default:
        throw invalid(`unsupported wire type ${key & 7}`);
    }
  }
}

const asBigInt = (value: FieldValue): bigint => (typeof value === "bigint" ? value : 0n);
const asBuffer = (value: FieldValue): Buffer =>
  typeof value === "bigint" ? Buffer.alloc(0) : value;

function readFileMapping(data: Buffer): IDepotFile {
  const file: IDepotFile = { name: "", size: 0, flags: 0, sha1: "", linkTarget: "" };
  for (const [fieldNumber, value] of fields(data)) {
    switch (fieldNumber) {
      case 1:
        file.name = asBuffer(value).toString("utf8");
        break;
      case 2:
        file.size = Number(asBigInt(value));
        break;
      case 3:
        file.flags = Number(asBigInt(value));
        break;
      case 5:
        file.sha1 = asBuffer(value).toString("hex");
        break;
      case 7:
        file.linkTarget = asBuffer(value).toString("utf8");
        break;
    }
  }
  return file;
}

export function readDepotManifest(data: Buffer): IDepotManifest {
  const result: IDepotManifest = {
    depotId: 0,
    manifestId: "0",
    filenamesEncrypted: false,
    files: [],
  };

  let offset = 0;
  while (offset < data.length) {
    if (offset + 4 > data.length) throw invalid("section header runs past the end");
    const magic = data.readUInt32LE(offset);
    offset += 4;
    if (magic === MAGIC_END) break;
    if (magic !== MAGIC_PAYLOAD && magic !== MAGIC_METADATA && magic !== MAGIC_SIGNATURE) {
      throw invalid(`unknown section magic 0x${magic.toString(16)}`);
    }
    if (offset + 4 > data.length) throw invalid("section length runs past the end");
    const length = data.readUInt32LE(offset);
    offset += 4;
    if (offset + length > data.length) throw invalid("section runs past the end");
    const body = data.subarray(offset, offset + length);
    offset += length;

    if (magic === MAGIC_PAYLOAD) {
      for (const [fieldNumber, value] of fields(body)) {
        if (fieldNumber === 1) result.files.push(readFileMapping(asBuffer(value)));
      }
    } else if (magic === MAGIC_METADATA) {
      for (const [fieldNumber, value] of fields(body)) {
        if (fieldNumber === 1) result.depotId = Number(asBigInt(value));
        else if (fieldNumber === 2) result.manifestId = asBigInt(value).toString();
        else if (fieldNumber === 4) result.filenamesEncrypted = asBigInt(value) !== 0n;
      }
    }
  }

  return result;
}
