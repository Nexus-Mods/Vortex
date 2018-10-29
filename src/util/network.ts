import { IncomingMessage } from 'http';
import { get } from 'https';
import * as url from 'url';

export function jsonRequest<T>(apiURL: string): Promise<T> {
    return new Promise((resolve, reject) => {
      get({
        ...url.parse(apiURL),
        headers: { 'User-Agent': 'Vortex' },
      } as any, (res: IncomingMessage) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let err: string;
        if (statusCode !== 200) {
          err = `Request Failed. Status Code: ${statusCode}`;
        } else if (!/^application\/json/.test(contentType)) {
          err = `Invalid content-type ${contentType}`;
        }

        if (err !== undefined) {
          res.resume();
          return reject(new Error(err));
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(rawData));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', (err: Error) => {
        return reject(err);
      });
    });
  }

