import { createReadStream } from "node:fs";

import * as crc32 from "crc-32";

/** The CRC32 of a file as 8 upper-case hex digits, read in chunks so any file size works. */
export async function fileCRC32(filePath: string): Promise<string> {
  let crc = 0;
  for await (const chunk of createReadStream(filePath, { highWaterMark: 1024 * 1024 })) {
    crc = crc32.buf(chunk, crc);
  }
  // >>> 0 converts signed to unsigned
  return (crc >>> 0).toString(16).toUpperCase().padStart(8, "0");
}
