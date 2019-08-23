import * as fs from './fs';

import { createHash } from 'crypto';

export function checksum(input: Buffer): string {
  return createHash('md5')
    .update(input)
    .digest('hex');
}

export function fileMD5(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('readable', () => {
      const data = stream.read();
      if (data) {
        hash.update(data);
      }
    });
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
