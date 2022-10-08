import * as fs from '../../../util/fs';

import NexusT, { IFeedbackResponse } from '@nexusmods/nexus-api';
import Bluebird from 'bluebird';
import ZipT = require('node-7z');
import { tmpName } from 'tmp';

function zipFiles(files: string[]): Bluebird<string> {
  if (files.length === 0) {
    return Bluebird.resolve(undefined);
  }
  const Zip: typeof ZipT = require('node-7z');
  const task: ZipT = new Zip();

  return new Bluebird<string>((resolve, reject) => {
    tmpName({
      postfix: '.7z',
    }, (err, tmpPath: string) => (err !== null)
      ? reject(err)
      : resolve(tmpPath));
  })
    .then(tmpPath =>
      task.add(tmpPath, files, { ssw: true })
        .then(() => tmpPath));
}

function submitFeedback(nexus: NexusT, title: string, message: string, feedbackFiles: string[],
                        anonymous: boolean, hash: string): Bluebird<IFeedbackResponse> {
  let archive: string;
  return zipFiles(feedbackFiles)
    .then(tmpPath => {
      archive = tmpPath;
      return nexus.sendFeedback(title, message, tmpPath, anonymous, hash);
    })
    .finally(() => {
      if (archive !== undefined) {
        fs.removeAsync(archive);
      }
    });
}

export default submitFeedback;
