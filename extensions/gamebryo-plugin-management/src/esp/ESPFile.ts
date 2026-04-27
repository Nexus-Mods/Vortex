import * as fs from "fs";
import { BufferReader } from "typed-binary";
import { RecordHeader, SubRecordHeader, HEDRData } from "./schemas";
import {
  FLAG_MASTER,
  FLAG_LIGHT,
  SF_FLAG_LIGHT,
  FLAG_MEDIUM,
  SF_FLAG_BLUEPRINT,
} from "./constants";
import { InvalidFileError, InvalidRecordError } from "./errors";

/** Read a null-terminated ASCII string from a buffer region. */
function readNullTermString(
  buf: Buffer,
  offset: number,
  maxLen: number,
): string {
  let end = offset;
  const limit = offset + maxLen;
  while (end < limit && buf[end] !== 0) end++;
  return buf.toString("ascii", offset, end);
}

/**
 * Pure TypeScript replacement for the native C++ esptk addon.
 * Parses Bethesda ESP/ESM/ESL plugin file headers using typed-binary
 * for declarative struct definitions.
 *
 * API is identical to the C++ version for drop-in replacement.
 */
export class ESPFile {
  private _filePath: string;
  private _gameMode: string;
  private _flags: number = 0;
  private _revision: number = 0;
  private _numRecords: number = 0;
  private _author: string = "";
  private _description: string = "";
  private _masters: string[] = [];

  constructor(filePath: string, gameMode: string) {
    this._filePath = filePath;
    this._gameMode = gameMode;

    let buf: Buffer;
    try {
      buf = fs.readFileSync(filePath);
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

    this.parse(buf);
  }

  private parse(buf: Buffer): void {
    if (buf.length < 20) {
      throw new InvalidFileError("file incomplete", this._filePath);
    }

    // Create an ArrayBuffer for typed-binary from the Node Buffer
    const ab = buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    );
    const reader = new BufferReader(ab, { endianness: "little" });

    // Read TES4 record header (20 bytes)
    const header = RecordHeader.read(reader);
    if (header.type !== "TES4") {
      throw new InvalidFileError("invalid file type", this._filePath);
    }

    this._flags = header.flags;

    // The C++ esptk reads 4 bytes after the 20-byte header as "version info".
    // revision() returns those 4 bytes interpreted as uint32le.
    // For Oblivion-style files, these bytes are actually "HEDR" (the first
    // subrecord tag), so revision() returns 0x52444548 = 1380205896.
    const headerEnd = reader.currentByteOffset; // should be 20
    let oblivionStyle = false;

    if (buf.length >= headerEnd + 4) {
      // Read the 4 version-info bytes as uint32le for the revision value
      this._revision = buf.readUInt32LE(headerEnd);

      if (
        buf[headerEnd] === 0x48 && // H
        buf[headerEnd + 1] === 0x45 && // E
        buf[headerEnd + 2] === 0x44 && // D
        buf[headerEnd + 3] === 0x52 // R
      ) {
        oblivionStyle = true;
      }
    }

    if (!oblivionStyle) {
      reader.skipBytes(4); // skip version info
    }

    // Parse subrecords within the data region
    const dataEnd = reader.currentByteOffset + header.dataSize;
    let sizeOverride = 0;

    while (reader.currentByteOffset < dataEnd) {
      if (reader.currentByteOffset + 6 > buf.length) break;

      const sub = SubRecordHeader.read(reader);

      if (sub.type === "XXXX") {
        // XXXX provides a uint32 size override for the next subrecord
        if (sub.size !== 4) {
          throw new InvalidRecordError(
            "XXXX record is supposed to be 4 bytes in size",
            this._filePath,
          );
        }
        sizeOverride = reader.readUint32();
        continue;
      }

      const dataSize = sizeOverride || sub.size;
      sizeOverride = 0;

      if (reader.currentByteOffset + dataSize > buf.length) {
        throw new InvalidRecordError(
          `sub-record incomplete: ${sub.type}`,
          this._filePath,
        );
      }

      switch (sub.type) {
        case "HEDR": {
          if (dataSize >= 12) {
            const hedr = HEDRData.read(reader);
            this._numRecords = hedr.numRecords;
            if (dataSize > 12) reader.skipBytes(dataSize - 12);
          } else {
            // Invalid HEDR size — set numRecords to 1 to prevent
            // appearing as a dummy plugin (matches C++ behavior)
            this._numRecords = 1;
            reader.skipBytes(dataSize);
          }
          break;
        }
        case "MAST": {
          if (dataSize > 0) {
            this._masters.push(
              readNullTermString(buf, reader.currentByteOffset, dataSize),
            );
          }
          reader.skipBytes(dataSize);
          break;
        }
        case "CNAM": {
          if (dataSize > 0) {
            this._author = readNullTermString(
              buf,
              reader.currentByteOffset,
              dataSize,
            );
          }
          reader.skipBytes(dataSize);
          break;
        }
        case "SNAM": {
          if (dataSize > 0) {
            this._description = readNullTermString(
              buf,
              reader.currentByteOffset,
              dataSize,
            );
          }
          reader.skipBytes(dataSize);
          break;
        }
        default:
          reader.skipBytes(dataSize);
          break;
      }
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
  setLightFlag(enabled: boolean): void {
    const fd = fs.openSync(this._filePath, "r+");
    try {
      const flagBuf = Buffer.alloc(4);
      fs.readSync(fd, flagBuf, 0, 4, 8);
      let flags = flagBuf.readUInt32LE(0);

      const flagBit =
        this._gameMode === "starfield" ? SF_FLAG_LIGHT : FLAG_LIGHT;
      flags = enabled ? flags | flagBit : flags & ~flagBit;

      flagBuf.writeUInt32LE(flags, 0);
      fs.writeSync(fd, flagBuf, 0, 4, 8);
    } finally {
      fs.closeSync(fd);
    }
  }
}
