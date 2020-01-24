import { get as getHTTP, IncomingMessage } from 'http';
import { get as getHTTPS } from 'https';
import * as url from 'url';

export interface IRequestOptions {
  expectedContentType?: RegExp;
  encoding?: string;
}

export function rawRequest(apiURL: string, options?: IRequestOptions): Promise<string> {
  if (options === undefined) {
    options = {};
  }

  return new Promise((resolve, reject) => {
    const parsed = url.parse(apiURL);
    const get = (parsed.protocol === 'http:')
      ? getHTTP
      : getHTTPS;

    get({
      ...parsed,
      headers: { 'User-Agent': 'Vortex' },
    } as any, (res: IncomingMessage) => {
      const { statusCode } = res;
      const contentType = res.headers['content-type'];

      let err: string;
      if (statusCode !== 200) {
        err = `Request Failed. Status Code: ${statusCode}`;
      } else if ((options.expectedContentType !== undefined)
        && !options.expectedContentType.test(contentType)) {
        err = `Invalid content-type ${contentType}`;
      }

      if (options.encoding !== undefined) {
        res.setEncoding(options.encoding);
      }
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          resolve(rawData);
        } catch (e) {
          reject(e);
        }
      })
        .on('error', (reqErr: Error) => {
          return reject(reqErr);
        });
    });
  });
}

export function jsonRequest<T>(apiURL: string): Promise<T> {
  return rawRequest(apiURL, {
    expectedContentType: /^(application\/json|text\/plain)/,
    encoding: 'utf-8',
  })
  .then(rawData => JSON.parse(rawData));
}
