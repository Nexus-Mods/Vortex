import * as zlib from 'zlib';
import * as lz4 from 'lz4js';

/**
 * Sequential binary reader over a Buffer.
 *
 * Supports mid-stream decompression (zlib/LZ4) for Skyrim SE saves,
 * optional field markers ('|') for Fallout 3/NV saves, and
 * two string formats: standard (uint16 length prefix) and BZ-string
 * (uint8 length prefix, null terminated) for Oblivion.
 */
export class BinaryReader {
  private buf: Buffer;
  private offset: number;
  private hasFieldMarkers: boolean = false;
  private bzStringMode: boolean = false;
  private encoding: string = 'utf8';

  constructor(buf: Buffer) {
    this.buf = buf;
    this.offset = 0;
  }

  tell(): number {
    return this.offset;
  }

  seek(pos: number): void {
    this.offset = pos;
  }

  skip(bytes: number): void {
    this.offset += bytes;
    if (this.offset > this.buf.length) {
      throw new Error(`Unexpected end of file at ${this.offset} (skip of ${bytes} bytes)`);
    }
  }

  setFieldMarkers(enabled: boolean): void {
    this.hasFieldMarkers = enabled;
  }

  setBZString(enabled: boolean): void {
    this.bzStringMode = enabled;
  }

  setEncoding(enc: string): void {
    this.encoding = enc;
  }

  /** Check if the file starts with the given magic string */
  checkHeader(expected: string): boolean {
    if (this.buf.length < expected.length) return false;
    const found = this.buf.toString('ascii', 0, expected.length);
    if (found === expected) {
      this.offset = expected.length;
      return true;
    }
    return false;
  }

  readUint8(): number {
    if (this.offset + 1 > this.buf.length) {
      throw new Error(`Unexpected end of file at ${this.offset} (read of 1 byte)`);
    }
    const val = this.buf.readUInt8(this.offset);
    this.offset += 1;
    if (this.hasFieldMarkers) this.consumeFieldMarker();
    return val;
  }

  readUint16(): number {
    if (this.offset + 2 > this.buf.length) {
      throw new Error(`Unexpected end of file at ${this.offset} (read of 2 bytes)`);
    }
    const val = this.buf.readUInt16LE(this.offset);
    this.offset += 2;
    if (this.hasFieldMarkers) this.consumeFieldMarker();
    return val;
  }

  readUint32(): number {
    if (this.offset + 4 > this.buf.length) {
      throw new Error(`Unexpected end of file at ${this.offset} (read of 4 bytes)`);
    }
    const val = this.buf.readUInt32LE(this.offset);
    this.offset += 4;
    if (this.hasFieldMarkers) this.consumeFieldMarker();
    return val;
  }

  readInt32(): number {
    if (this.offset + 4 > this.buf.length) {
      throw new Error(`Unexpected end of file at ${this.offset} (read of 4 bytes)`);
    }
    const val = this.buf.readInt32LE(this.offset);
    this.offset += 4;
    if (this.hasFieldMarkers) this.consumeFieldMarker();
    return val;
  }

  readInt64(): bigint {
    if (this.offset + 8 > this.buf.length) {
      throw new Error(`Unexpected end of file at ${this.offset} (read of 8 bytes)`);
    }
    const val = this.buf.readBigInt64LE(this.offset);
    this.offset += 8;
    if (this.hasFieldMarkers) this.consumeFieldMarker();
    return val;
  }

  readFloat(): number {
    if (this.offset + 4 > this.buf.length) {
      throw new Error(`Unexpected end of file at ${this.offset} (read of 4 bytes)`);
    }
    const val = this.buf.readFloatLE(this.offset);
    this.offset += 4;
    if (this.hasFieldMarkers) this.consumeFieldMarker();
    return val;
  }

  /**
   * Read a length-prefixed string.
   * In BZ-string mode: uint8 length + data + null terminator.
   * In standard mode: uint16 length + data.
   *
   * When field markers are enabled, markers appear after both the length
   * prefix and the string data (matching C++ templated read behavior).
   */
  readString(): string {
    let length: number;
    if (this.bzStringMode) {
      // Use readUint8 so field marker after length is consumed
      length = this.readUint8();
    } else {
      // Use readUint16 so field marker after length is consumed
      length = this.readUint16();
    }

    if (length === 0) return '';

    const raw = this.buf.subarray(this.offset, this.offset + length);
    this.offset += length;

    let str: string;
    if (this.bzStringMode) {
      // BZ-strings include the null terminator in the length
      str = this.decodeString(raw.subarray(0, raw.length - 1));
    } else {
      str = this.decodeString(raw);
    }

    if (this.hasFieldMarkers) {
      this.consumeFieldMarker();
    }

    return str;
  }

  /** Read a BString: uint8 length + data (no null terminator, no field marker) */
  readBString(): string {
    const length = this.buf.readUInt8(this.offset);
    this.offset += 1;
    const raw = this.buf.subarray(this.offset, this.offset + length);
    this.offset += length;
    return this.decodeString(raw);
  }

  /** Read raw bytes into a Buffer */
  readBytes(length: number): Buffer {
    if (this.offset + length > this.buf.length) {
      throw new Error(`Unexpected end of file at ${this.offset} (read of ${length} bytes)`);
    }
    const result = this.buf.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }

  /**
   * Read a screenshot image.
   * If dimensions are not provided, reads them from the stream (uint32 width, uint32 height).
   * If alpha is true, the image is RGBA (4bpp), otherwise RGB (3bpp) converted to RGBA.
   */
  readImage(width?: number, height?: number, alpha: boolean = false): {
    width: number;
    height: number;
    data: Buffer;
  } {
    if (width === undefined || height === undefined) {
      width = this.readUint32();
      height = this.readUint32();
    }

    if (width >= 2000) throw new Error(`Invalid screenshot width: ${width}`);
    if (height >= 2000) throw new Error(`Invalid screenshot height: ${height}`);

    const bpp = alpha ? 4 : 3;
    const bytes = width * height * bpp;
    const raw = this.readBytes(bytes);

    let data: Buffer;
    if (alpha) {
      data = Buffer.from(raw);
    } else {
      // Convert RGB to RGBA
      const rgba = Buffer.alloc(width * height * 4);
      let inIdx = 0;
      let outIdx = 0;
      for (let i = 0; i < width * height; i++) {
        rgba[outIdx++] = raw[inIdx++]; // R
        rgba[outIdx++] = raw[inIdx++]; // G
        rgba[outIdx++] = raw[inIdx++]; // B
        rgba[outIdx++] = 0xFF;         // A
      }
      data = rgba;
    }

    return { width, height, data };
  }

  /** Read the plugin list: uint8 count + strings */
  readPlugins(bStrings: boolean = false): string[] {
    const count = this.readUint8();
    const plugins: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = bStrings ? this.readBString() : this.readString();
      if (name.length > 256) throw new Error(`Invalid plugin name at offset ${this.offset}`);
      plugins.push(name);
    }
    return plugins;
  }

  /** Read light plugin list: uint16 count + strings */
  readLightPlugins(): string[] {
    const count = this.readUint16();
    const plugins: string[] = [];
    for (let i = 0; i < count; i++) {
      const name = this.readString();
      if (name.length > 256) throw new Error(`Invalid light plugin name at offset ${this.offset}`);
      plugins.push(name);
    }
    return plugins;
  }

  /**
   * Switch the buffer to decompressed content from the current offset.
   * format 1 = zlib, format 2 = LZ4.
   */
  setCompression(format: number, compressedSize: number, uncompressedSize: number): void {
    const compressed = this.readBytes(compressedSize);

    let decompressed: Buffer;
    if (format === 1) {
      // inflateSync (not inflateRawSync) — Skyrim SE saves use zlib-wrapped compression
      // (2-byte header + adler32 checksum), matching the C++ implementation's inflateInit behavior.
      decompressed = zlib.inflateSync(compressed, { maxOutputLength: uncompressedSize });
    } else if (format === 2) {
      const output = Buffer.alloc(uncompressedSize);
      lz4.decompressBlock(compressed, output, 0, compressedSize, 0);
      decompressed = output;
    } else {
      throw new Error(`Unknown compression format: ${format}`);
    }

    this.buf = decompressed;
    this.offset = 0;
  }

  private consumeFieldMarker(): void {
    if (this.offset < this.buf.length) {
      const marker = this.buf.readUInt8(this.offset);
      if (marker !== 0x7c) {
        throw new Error(`Expected field separator '|' at offset ${this.offset}, got 0x${marker.toString(16)}`);
      }
      this.offset += 1;
    }
  }

  private decodeString(raw: Buffer): string {
    if (this.encoding === 'windows-1251') {
      const decoder = new TextDecoder('windows-1251');
      return decoder.decode(raw);
    }

    // Try UTF-8 first, fall back to latin1
    try {
      const str = raw.toString('utf8');
      // Check if the UTF-8 decode produced replacement characters
      if (!str.includes('\uFFFD')) return str;
    } catch (e) {
      // fall through
    }

    return raw.toString('latin1');
  }
}
