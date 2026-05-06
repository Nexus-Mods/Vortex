import * as fs from "fs";

// Schema definitions in ./schemas.ts serve as the declarative format spec.
// This module reads directly from the Buffer for performance.
import {
  FLAG_MASTER,
  FLAG_LIGHT,
  SF_FLAG_LIGHT,
  FLAG_MEDIUM,
  SF_FLAG_BLUEPRINT,
} from "./constants";
import { InvalidFileError, InvalidRecordError } from "./errors";

/** Read a null-terminated ASCII string from a buffer region. */
function readNullTermString(buf: Buffer, offset: number, maxLen: number): string {
  const limit = offset + maxLen;
  const nullPos = buf.indexOf(0, offset);
  const end = nullPos >= 0 && nullPos < limit ? nullPos : limit;
  return buf.toString("ascii", offset, end);
}

// 4-byte subrecord type tags as little-endian uint32 for fast integer comparison
const TAG_TES4 = 0x34534554; // "TES4"
const TAG_HEDR = 0x52444548; // "HEDR"
const TAG_MAST = 0x5453414d; // "MAST"
const TAG_CNAM = 0x4d414e43; // "CNAM"
const TAG_SNAM = 0x4d414e53; // "SNAM"
const TAG_XXXX = 0x58585858; // "XXXX"

/**
 * Pure TypeScript ESP/ESM/ESL plugin file parser.
 *
 * Use the static `open()` method to parse a file:
 *   const esp = await ESPFile.open(filePath, gameMode);
 */
export class ESPFile {
  private _filePath: string = "";
  private _gameMode: string = "";
  private _flags: number = 0;
  private _revision: number = 0;
  private _numRecords: number = 0;
  private _author: string = "";
  private _description: string = "";
  private _masters: string[] = [];

  private constructor() {}

  /**
   * Open and parse an ESP/ESM/ESL plugin file header.
   * Only reads the TES4 record (~200 bytes to ~50KB), not the entire file.
   */
  static async open(filePath: string, gameMode: string): Promise<ESPFile> {
    const esp = new ESPFile();
    esp._filePath = filePath;
    esp._gameMode = gameMode;

    let fh: fs.promises.FileHandle;
    try {
      fh = await fs.promises.open(filePath, "r");
    } catch (e: any) {
      if (e.code === "ENOENT") {
        const err = new Error("file not found") as any;
        err.name = "FileMissingError";
        err.code = "ENOENT";
        err.path = filePath;
        throw err;
      }
      throw e;
    }

    try {
      // Read only the TES4 header record, not the entire file.
      // First read 24 bytes: 20-byte record header + 4 bytes version info.
      const header = Buffer.alloc(24);
      const { bytesRead } = await fh.read(header, 0, 24, 0);
      if (bytesRead < 24) {
        throw new InvalidFileError("file incomplete", filePath);
      }

      const dataSize = header.readUInt32LE(4);
      const totalSize = 24 + dataSize;
      const buf = Buffer.alloc(totalSize);
      header.copy(buf);
      if (dataSize > 0) {
        await fh.read(buf, 24, dataSize, 24);
      }

      esp.parse(buf);
    } finally {
      await fh.close();
    }

    return esp;
  }

  private parse(buf: Buffer): void {
    if (buf.length < 24) {
      throw new InvalidFileError("file incomplete", this._filePath);
    }

    // Read TES4 record header directly from Buffer (20 bytes)
    // Layout: type[4] + dataSize[4] + flags[4] + id[4] + revision[4]
    if (buf.readUInt32LE(0) !== TAG_TES4) {
      throw new InvalidFileError("invalid file type", this._filePath);
    }

    const dataSize = buf.readUInt32LE(4);
    this._flags = buf.readUInt32LE(8);

    // The 4 bytes after the 20-byte header are "version info".
    // revision() returns those 4 bytes interpreted as uint32le.
    // For Oblivion-style files, these bytes are actually "HEDR" (the first
    // subrecord tag), so revision() returns 0x52444548 = 1380205896.
    this._revision = buf.readUInt32LE(20);

    // Oblivion-style: if version info bytes are "HEDR", subrecords start at 20
    let offset = this._revision === TAG_HEDR ? 20 : 24;
    const dataEnd = offset + dataSize;
    let sizeOverride = 0;

    // Parse subrecords: each is tag[4] + size[2] + data[size]
    while (offset + 6 <= dataEnd && offset + 6 <= buf.length) {
      const tag = buf.readUInt32LE(offset);
      const subSize = buf.readUInt16LE(offset + 4);
      offset += 6;

      if (tag === TAG_XXXX) {
        if (subSize !== 4) {
          throw new InvalidRecordError(
            "XXXX record is supposed to be 4 bytes in size",
            this._filePath,
          );
        }
        sizeOverride = buf.readUInt32LE(offset);
        offset += 4;
        continue;
      }

      const payloadSize = sizeOverride || subSize;
      sizeOverride = 0;

      if (offset + payloadSize > buf.length) {
        throw new InvalidRecordError("sub-record incomplete", this._filePath);
      }

      switch (tag) {
        case TAG_HEDR: {
          if (payloadSize >= 12) {
            this._numRecords = buf.readInt32LE(offset + 4);
          } else {
            this._numRecords = 1;
          }
          break;
        }
        case TAG_MAST: {
          if (payloadSize > 0) {
            this._masters.push(readNullTermString(buf, offset, payloadSize));
          }
          break;
        }
        case TAG_CNAM: {
          if (payloadSize > 0) {
            this._author = readNullTermString(buf, offset, payloadSize);
          }
          break;
        }
        case TAG_SNAM: {
          if (payloadSize > 0) {
            this._description = readNullTermString(buf, offset, payloadSize);
          }
          break;
        }
      }

      offset += payloadSize;
    }
  }

  get isMaster(): boolean {
    return (this._flags & FLAG_MASTER) !== 0;
  }

  get isLight(): boolean {
    if (this._gameMode === "starfield") {
      return (this._flags & SF_FLAG_LIGHT) !== 0;
    }
    return (this._flags & FLAG_LIGHT) !== 0;
  }

  get isMedium(): boolean {
    return (this._flags & FLAG_MEDIUM) !== 0;
  }

  get isBlueprint(): boolean {
    return (this._flags & SF_FLAG_BLUEPRINT) !== 0;
  }

  get isDummy(): boolean {
    return this._numRecords === 0;
  }

  get author(): string {
    return this._author;
  }

  get description(): string {
    return this._description;
  }

  get masterList(): string[] {
    return this._masters;
  }

  get masters(): string[] {
    return this._masters;
  }

  get revision(): number {
    return this._revision;
  }

  /**
   * Modify the light plugin flag in the file header.
   * Writes the 4-byte flags field directly at offset 8.
   */
  async setLightFlag(enabled: boolean): Promise<void> {
    const fh = await fs.promises.open(this._filePath, "r+");
    try {
      const flagBuf = Buffer.alloc(4);
      await fh.read(flagBuf, 0, 4, 8);
      let flags = flagBuf.readUInt32LE(0);

      const flagBit = this._gameMode === "starfield" ? SF_FLAG_LIGHT : FLAG_LIGHT;
      flags = enabled ? flags | flagBit : flags & ~flagBit;

      flagBuf.writeUInt32LE(flags, 0);
      await fh.write(flagBuf, 0, 4, 8);
    } finally {
      await fh.close();
    }
  }
}
