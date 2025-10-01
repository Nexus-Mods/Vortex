import * as fs from '../../../util/fs';

import NexusT, { IFeedbackResponse } from '@nexusmods/nexus-api';
import Promise from 'bluebird';
import ZipT = require('node-7z');
import { addToArchive } from '../../../util/archive';
import { tmpName } from 'tmp';

function zipFiles(files: string[]): Promise<string> {
  if (files.length === 0) {
    return Promise.resolve(undefined);
  }
  return new Promise<string>((resolve, reject) => {
    tmpName({
      postfix: '.7z',
    }, (err, tmpPath: string) => (err !== null)
      ? reject(err)
      : resolve(tmpPath));
  })
    .then(tmpPath =>
      addToArchive(tmpPath, files, { ssw: true })
        .then(() => tmpPath));
}

function submitFeedback(nexus: NexusT, title: string, message: string, feedbackFiles: string[],
                        anonymous: boolean, hash: string): Promise<IFeedbackResponse> {
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
