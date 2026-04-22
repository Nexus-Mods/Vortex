import * as fs from "./fs";

import { createHash } from "crypto";

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

  const stats = await fs.statAsync(input);
  const totalSize = stats.size;

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
