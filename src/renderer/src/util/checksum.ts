import { createHash } from "crypto";

import * as fs from "./fs";

export function checksum(input: Buffer): string {
  return createHash("md5").update(input).digest("hex");
}

export async function fileMD5(
  input: string | Buffer,
  progress?: (bytesProcessed: number, totalBytes: number) => void,
): Promise<string> {
  if (Buffer.isBuffer(input)) {
    const hex = createHash("md5").update(input).digest("hex");
    progress?.(input.length, input.length);
    return hex;
  }

  // Only stat the file when a progress callback is provided. The stat is
  // needed to report (bytesProcessed, totalBytes), but is a wasted syscall
  // when nobody is listening.
  const totalSize = progress ? await fs.statAsync(input).then((s) => s.size) : 0;

  return new Promise<string>((resolve, reject) => {
    const hash = createHash("md5");
    let bytesRead = 0;

    const stream = fs.createReadStream(input);
    stream.on("data", (data: Buffer) => {
      hash.update(data);
      bytesRead += data.length;
      progress?.(bytesRead, totalSize);
    });
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}
