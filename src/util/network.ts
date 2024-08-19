/* eslint-disable */
import { get as getHTTP, IncomingMessage, request as requestHTTP, ClientRequest } from 'http';
import { get as getHTTPS, request as requestHTTPS } from 'https';
import { Readable } from 'stream';
import * as url from 'url';
import { DataInvalid, TemporaryError } from './CustomErrors';
import { log } from './log';

export interface IRequestOptions {
  expectedContentType?: RegExp;
  encoding?: BufferEncoding;
}

export function rawRequest(apiURL: string, options?: IRequestOptions): Promise<string | Buffer> {
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
      let rawData: string | Buffer = (options.encoding !== undefined)
        ? ''
        : Buffer.alloc(0);
      res.on('data', (chunk) => {
        if (options.encoding !== undefined) {
          rawData += chunk;
        } else {
          rawData = Buffer.concat([rawData, chunk]);
        }
      });
      res.on('end', () => {
        if (!!err) {
          const errMsg = new TemporaryError(err);
          errMsg.message = rawData.toString(options?.encoding || 'utf-8');
          return reject(errMsg);
        }
        try {
          return resolve(rawData);
        } catch (e) {
          return reject(e);
        }
      })
        .on('error', reject);
    })
    .on('error', reject);
  });
}

export function jsonRequest<T>(apiURL: string): Promise<T> {
  return rawRequest(apiURL, {
    expectedContentType: /^(application\/json|text\/plain)/,
    encoding: 'utf-8',
  })
  .then(rawData => {
    try {
      return JSON.parse(rawData as string);
    } catch (err) {
      return Promise.reject(new DataInvalid('Invalid json response: ' + rawData));
    }
  });
}

export type Method = 'GET' | 'POST' | 'PUT';

export function request(method: Method,
                        reqURL: string,
                        headers: any,
                        cb: (res: IncomingMessage) => void): ClientRequest {
  const parsed = url.parse(reqURL);
  const reqFunc = (parsed.protocol === 'http:')
    ? requestHTTP
    : requestHTTPS;

  const result: ClientRequest = reqFunc({
    ...parsed,
    method,
    headers: { 'User-Agent': 'Vortex', ...headers },
  }, cb);
  return result;
}

export function upload(targetUrl: string, dataStream: Readable, dataSize: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    log('debug', 'uploading file', { targetUrl, dataSize });
    const started = Date.now();
    const req = request('PUT', targetUrl, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': dataSize.toString(),
    }, res => {
      const { statusCode } = res;
      log('debug', 'upload complete',
          { targetUrl, dataSize, statusCode, elapsed: Date.now() - started });

      let err: string;
      if (statusCode !== 200) {
        err = `Request Failed. Status Code: ${statusCode}`;
      }

      let rawData: Buffer = Buffer.alloc(0);
      res.on('data', (chunk) => {
        rawData = Buffer.concat([rawData, chunk]);
      })
      .on('end', () => {
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
    req.on('error', err => {
      return reject(err);
    });
    dataStream.pipe(req, {
      end: true,
    });
  });
}
