import * as fs from 'fs-extra-promise';
import ZipT = require('node-7z');
import request = require('request');
import { tmpName } from 'tmp';

export class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

function submitFeedback(APIKey: string, message: string, feedbackFiles: string[]): Promise<void> {
  const Zip: typeof ZipT = require('node-7z');
  const task: ZipT = new Zip();
  return new Promise<string>((resolve, reject) => {
    const filePath = tmpName({
      postfix: '.7z',
    }, (err, tmpPath: string) => {
      if (err !== null) {
        return reject(err);
      }
      return resolve(tmpPath);
    });
  }).then(tmpPath => {
    return task.add(tmpPath, feedbackFiles, { ssw: true })
      .then(() => tmpPath);
  }).then(tmpPath => new Promise<any>((resolve, reject) => {
    const formData = {
      message,
      files: fs.createReadStream(tmpPath),
    };
    const headers = {
      'content-type': 'application/json',
    };
    if (APIKey) {
      headers['APIKEY'] = APIKey;
    }
    request.post({
      headers,
      url: 'https://api.nexusmods.com/v1/feedback/',
      formData,
      timeout: 15000,
    }, (error, response, body) => {
      fs.removeAsync(tmpPath)
      .then(() => {
        if (error !== null) {
          return reject(error);
        }
        resolve();
      });
    });
  }));
}

export default submitFeedback;
