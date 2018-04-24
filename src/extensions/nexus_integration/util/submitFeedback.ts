import * as fs from '../../../util/fs';
import { log } from '../../../util/log';

import * as Promise from 'bluebird';
import NexusT from 'nexus-api';
import ZipT from 'node-7z';
import { tmpName } from 'tmp';

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

function zipFiles(files: string[]): Promise<string> {
  if (files.length === 0) {
    return Promise.resolve(undefined);
  }
  const Zip: typeof ZipT = require('node-7z');
  const task: ZipT = new Zip();

  return new Promise<string>((resolve, reject) => {
    const filePath = tmpName({
      postfix: '.7z',
    }, (err, tmpPath: string) => (err !== null)
      ? reject(err)
      : resolve(tmpPath));
  })
    .then(tmpPath =>
      task.add(tmpPath, files, { ssw: true })
        .then(() => tmpPath));
}

function submitFeedback(nexus: NexusT, message: string, feedbackFiles: string[],
                        anonymous: boolean, hash: string): Promise<void> {
  let archive: string;
  return zipFiles(feedbackFiles)
    .then(tmpPath => {
      archive = tmpPath;
      return nexus.sendFeedback(message, tmpPath, anonymous, hash);
    })
    .then(() => {
      if (archive !== undefined) {
        fs.removeAsync(archive);
      }
    });
}

export default submitFeedback;
