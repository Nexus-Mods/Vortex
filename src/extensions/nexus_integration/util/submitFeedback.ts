import { log } from '../../../util/log';

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

function zipFiles(files: string[]): Promise<string> {
  if (files.length === 0) {
    return Promise.resolve(undefined);
  }
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
  }).then(tmpPath =>
    task.add(tmpPath, files, { ssw: true })
      .then(() => tmpPath));
}

function submitFeedback(APIKey: string, message: string, feedbackFiles: string[]): Promise<void> {
  return zipFiles(feedbackFiles)
    .then(tmpPath => new Promise<any>((resolve, reject) => {
      const formData = {
        feedback_text: message,
      };
      if (tmpPath !== undefined) {
        formData['feedback_file'] = fs.createReadStream(tmpPath);
      }
      const headers = {};

      if (APIKey) {
        headers['APIKEY'] = APIKey;
      }

      const url = APIKey === null
        ? 'https://api.nexusmods.com/v1/feedbacks/anonymous'
        : 'https://api.nexusmods.com/v1/feedbacks';
      request.post({
        headers,
        url,
        formData,
        timeout: 15000,
      }, (error, response, body) => {
        // TODO: write out only the response once the api is done
        log('debug', 'got response for feedback', { error, response, body });
        if (tmpPath) {
          fs.removeAsync(tmpPath)
            .then(() => {
              if (error !== null) {
                return reject(error);
              }
              resolve();
            });
        } else {
          if (error !== null) {
            return reject(error);
          }
          resolve();
        }
      });
    }));
}

export default submitFeedback;
