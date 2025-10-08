/* eslint-disable */
import { DataInvalid, HTTPError, ProcessCanceled,
         StalledError, UserCanceled } from '../../util/CustomErrors';
import makeRemoteCall from '../../util/electronRemote';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { countIf, INVALID_FILENAME_RE, truthy } from '../../util/util';
import { IChunk } from './types/IChunk';
import { IDownloadOptions } from './types/IDownload';
import { IDownloadJob } from './types/IDownloadJob';
import { IDownloadResult } from './types/IDownloadResult';
import { ProgressCallback } from './types/ProgressCallback';
import { IProtocolHandlers, IResolvedURL, IResolvedURLs } from './types/ProtocolHandlers';

import makeThrottle from './util/throttle';

import FileAssembler from './FileAssembler';
import SpeedCalculator from './SpeedCalculator';

import Bluebird from 'bluebird';
import * as contentDisposition from 'content-disposition';
import * as contentType from 'content-type';
import * as http from 'http';
import * as https from 'https';
import * as _ from 'lodash';
import * as path from 'path';
import * as stream from 'stream';
import * as url from 'url';
import * as zlib from 'zlib';

const getCookies = makeRemoteCall('get-cookies',
  (electron, webContents, filter: Electron.CookiesGetFilter) => {
    return webContents.session.cookies.get(filter);
});

// assume urls are valid for at least 5 minutes
const URL_RESOLVE_EXPIRE_MS = 1000 * 60 * 5;
// don't follow redirects arbitrarily long
const MAX_REDIRECT_FOLLOW = 5;
// if we receive no data for this amount of time, reset the connection
const STALL_TIMEOUT = 15000;
const MAX_STALL_RESETS = 2;

export type RedownloadMode = 'always' | 'never' | 'ask' | 'replace';

export class AlreadyDownloaded extends Error {
  private mFileName: string;
  private mId: string;
  constructor(fileName: string, id?: string) {
    super('File already downloaded');
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.mFileName = fileName;
    this.mId = id;
  }

  public get fileName(): string {
    return this.mFileName;
  }

  public get downloadId() {
    return this.mId;
  }

  public set downloadId(id: string) {
    this.mId = id;
  }
}

export class DownloadIsHTML extends Error {
  private mUrl: string;
  constructor(inputUrl: string) {
    super('');
    this.name = this.constructor.name;
    this.mUrl = inputUrl;
  }

  public get url() {
    return this.mUrl;
  }
}

function isHTMLHeader(headers: http.IncomingHttpHeaders) {
  return (headers['content-type'] !== undefined)
    && (headers['content-type'].toString().startsWith('text/html'));
}

function contentTypeStr(input: string | contentType.RequestLike | contentType.ResponseLike) {
  try {
    return contentType.parse(input).type;
  } catch (err) {
    log('error', 'failed to parse content type', { input, error: err.message });
    return 'application/octet-stream';
  }
}

interface IHTTP {
  request: (options: https.RequestOptions | string | URL,
            callback?: (res: http.IncomingMessage) => void) => http.ClientRequest;
  Agent: typeof http.Agent;
}

interface IRunningDownload {
  id: string;
  fd?: number;
  error: boolean;
  urls: string[];
  resolvedUrls: () => Bluebird<IResolvedURLs>;
  origName: string;
  tempName: string;
  finalName?: Bluebird<string>;
  lastProgressSent: number;
  received: number;
  started: Date;
  options: IDownloadOptions;
  size?: number;
  headers?: any;
  assembler?: FileAssembler;
  assemblerProm?: Bluebird<FileAssembler>;
  chunks: IDownloadJob[];
  chunkable: boolean;
  promises: Array<Bluebird<any>>;
  progressCB?: ProgressCallback;
  finishCB: (res: IDownloadResult) => void;
  failedCB: (err) => void;
}

type FinishCallback = (paused: boolean, replaceFileName?: string) => void;

/**
 * a download worker. A worker is started to download one chunk of a file,
 * they are currently not reused.
 *
 * @class DownloadWorker
 */
class DownloadWorker {
  private static BUFFER_SIZE = 256 * 1024;
  private static BUFFER_SIZE_CAP = 4 * 1024 * 1024;
  private static MAX_NETWORK_RETRIES = 3; // Maximum number of network error retries
  private mJob: IDownloadJob;
  private mUrl: string;
  private mRequest: http.ClientRequest;
  private mProgressCB: (bytes: number) => void;
  private mFinishCB: FinishCallback;
  private mHeadersCB: (headers: any) => void;
  private mUserAgent: string;
  private mBuffers: Buffer[] = [];
  private mDataHistory: Array<{ time: number, size: number }> = [];
  private mEnded: boolean = false;
  private mResponse: http.IncomingMessage;
  private mWriting: boolean = false;
  private mRedirected: boolean = false;
  private mStallTimer: NodeJS.Timeout;
  private mStallResets: number = MAX_STALL_RESETS;
  private mRedirectsFollowed: number = 0;
  private mNetworkRetries: number = 0; // Track network error retries
  private mThrottle: () => stream.Transform;
  private mGetAgent: (protocol: string) => http.Agent | https.Agent;
  private mURLResolve: Bluebird<void>;
  private mOnAbort: () => void;

  constructor(job: IDownloadJob,
              progressCB: (bytes: number) => void,
              finishCB: FinishCallback,
              headersCB: (headers: any) => void,
              userAgent: string,
              throttle: () => stream.Transform,
              getAgent: (protocol: string) => http.Agent | https.Agent) {
    this.mProgressCB = progressCB;
    this.mFinishCB = finishCB;
    this.mHeadersCB = headersCB;
    this.mJob = job;
    this.mUserAgent = userAgent;
    this.mThrottle = throttle;
    this.mGetAgent = getAgent;
    
    this.mURLResolve = Bluebird.resolve(job.url())
      .then(jobUrl => {
        this.mUrl = jobUrl;
        if (jobUrl.startsWith('blob:')) {
          // in the case of blob downloads (meaning: javascript already placed the entire file
          // in local storage) the main process has already downloaded this file, we just have
          // to use it now
          job.received = job.size;
          job.size = 0;
          const [ignore, fileName] = jobUrl.split('<')[0].split('|');
          finishCB(false, fileName);
        } else {
          this.assignJob(job, jobUrl);
        }
      })
      .catch(err => {
        log('error', 'DownloadWorker URL resolution failed', {
          workerId: job.workerId || 'unknown',
          chunkOffset: job.offset,
          chunkSize: job.size,
          error: err.message
        });
        this.handleError(err);
      })
      .finally(() => {
        this.mURLResolve = undefined;
      });
  }

  public assignJob = (job: IDownloadJob, jobUrl: string) => {
    this.mDataHistory = [];
    log('debug', 'requesting range', { id: job.workerId, offset: job.offset, size: job.size });
    if (job.size <= 0) {
      this.handleComplete();
      return;
    }

    if (jobUrl === undefined) {
      this.handleError(new ProcessCanceled('No URL found for this download'));
      return;
    }

    try {
      getCookies({ url: jobUrl })
        .then(cookies => {
          this.startDownload(job, jobUrl, cookies);
        })
        .catch(err => {
          this.handleError(err);
        });
    } catch (err) {
      this.startDownload(job, jobUrl, []);
    }
  }

  public isPending = () => {
    return this.mEnded === false
      && this.mWriting === false
      && this.mJob.received === 0;
  }

  public ended = () => {
    return this.mEnded;
  }

  public cancel = () => {
    this.abort(false);
  }

  public pause = () => {
    if (this.abort(true)) {
      if (this.mResponse !== undefined) {
        this.mResponse.pause();
      }
    }
  }

  public restart = async () => {
    if (this.mEnded) {
      return;
    }

    // Clean up current request state
    this.mResponse?.removeAllListeners?.('error');
    this.mRequest?.destroy?.();
    clearTimeout(this.mStallTimer);

    // Reset worker state for restart
    this.mBuffers = [];
    this.mDataHistory = [];
    this.mWriting = false;
    this.mRedirected = false;
    this.mStallResets = MAX_STALL_RESETS;

    // Reset job state to what hasn't been confirmed yet
    this.mJob.offset = this.mJob.confirmedOffset + this.mJob.confirmedReceived;
    this.mJob.size = this.mJob.confirmedSize - this.mJob.confirmedReceived;
    this.mJob.received = 0;

    // Only restart if there's still data to download
    if (this.mJob.size > 0) {
      // Restart the job directly without going through handleComplete
      this.mJob.url().then(jobUrl => {
        this.assignJob(this.mJob, jobUrl);
      })
      .catch(err => {
        this.handleError(err);
      });
    } else {
      // Nothing left to download, complete normally
      this.handleComplete();
    }
  }

  private startDownload = (job: IDownloadJob, jobUrl: string, electronCookies: Electron.Cookie[]) => {
    if (this.mEnded) {
      // worker was canceled while the url was still being resolved
      return;
    }

    let parsed: url.UrlWithStringQuery;
    let referer: string;
    try {
      const [urlIn, refererIn] = jobUrl.split('<');
      // at some point in the past we'd encode the uri here which apparently led to double-encoded
      // uris. Then we'd decode it which led to the request failing if there were characters in
      // the url that required encoding.
      // Since all that was tested at some point I'm getting the feeling it's inconsistent in
      // the callers whether the url is encoded or not
      parsed = url.parse(urlIn);
      referer = refererIn;
      jobUrl = urlIn;
    } catch (err) {
      this.handleError(new Error('No valid URL for this download'));
      return;
    }

    if (referer === undefined) {
      referer = job.options.referer;
    }

    const lib: IHTTP = parsed.protocol === 'https:' ? https : http;

    const allCookies = this.formatCookies(electronCookies, this.mJob.extraCookies);

    try {
      const headers = {
          Range: `bytes=${job.offset}-${job.offset + job.size - 1}`,
          'User-Agent': this.mUserAgent,
          'Accept-Encoding': 'gzip, deflate',
          Cookie: allCookies,
        };
      if (referer !== undefined) {
        headers['Referer'] = referer;
      }

      const requestOptions = {
        method: 'GET',
        protocol: parsed.protocol,
        port: parsed.port,
        hostname: parsed.hostname,
        path: parsed.path,
        headers,
        agent: this.mGetAgent(parsed.protocol),
        timeout: 30000,
      };

      this.mRequest = lib.request(requestOptions, (res) => {
        if (!res || !res.socket) {
          this.handleError(new Error('Invalid response received'));
          return;
        }

        log('debug', 'downloading from',
          { address: `${res.socket.remoteAddress}:${res.socket.remotePort}` });

        this.mStallTimer = setTimeout(this.stalled, STALL_TIMEOUT);
        this.mResponse = res;

        let recodedURI: string;
        try {
          // Only re-encode if the URL appears to need it
          if (jobUrl.includes('%')) {
            recodedURI = jobUrl; // Already encoded
          } else {
            recodedURI = encodeURI(jobUrl); // Encode special characters
          }
        } catch (err) {
          log('warn', 'URL encoding failed, using original', { url: jobUrl, error: err.message });
          recodedURI = jobUrl;
        }
        this.handleResponse(res, recodedURI);
        let str: stream.Readable = res;

        try {
          str = str.pipe(this.mThrottle());

          const encoding = res.headers['content-encoding'];
          if (encoding === 'gzip') {
            const gunzip = zlib.createGunzip();
            gunzip.on('error', (err) => {
              log('warn', 'gzip decompression error', err.message);
              // Continue without decompression
            });
            str = str.pipe(gunzip);
          } else if (encoding === 'deflate') {
            const inflate = zlib.createInflate();
            inflate.on('error', (err) => {
              log('warn', 'deflate decompression error', err.message);
              // Continue without decompression
            });
            str = str.pipe(inflate);
          }
        } catch (err) {
          log('error', 'stream pipeline setup failed', err.message);
          this.handleError(err);
          return;
        }

        str
          .on('data', (data: Buffer) => {
            if (this.mEnded) return;

            clearTimeout(this.mStallTimer);
            this.mStallTimer = setTimeout(this.stalled, STALL_TIMEOUT);
            this.mStallResets = MAX_STALL_RESETS;
            this.handleData(data, str);
          })
          .on('error', err => {
            clearTimeout(this.mStallTimer);
            this.handleError(err);
          })
          .on('end', () => {
            clearTimeout(this.mStallTimer);
            if (!this.mRedirected && !this.mEnded) {
              this.handleComplete(str);
            }
            if (!this.mRequest?.destroyed) {
              this.mRequest.destroy();
            }
          });
      });

      this.mRequest
        .on('error', (err) => {
          log('error', 'DownloadWorker request error', { 
            workerId: job.workerId || 'unknown',
            chunkOffset: job.offset,
            error: err.message 
          });
          clearTimeout(this.mStallTimer);
          this.handleError(err);
        })
        .on('timeout', () => {
          log('warn', 'DownloadWorker request timeout', { 
            workerId: job.workerId || 'unknown',
            chunkOffset: job.offset
          });
          clearTimeout(this.mStallTimer);
          const timeoutError = new Error('Request timeout');
          timeoutError['code'] = 'ETIMEDOUT';
          this.handleError(timeoutError);
        })
        .end();
    } catch (err) {
      clearTimeout(this.mStallTimer);
      this.handleError(err);
    }
  }

  private formatCookies(electronCookies: Electron.Cookie[], extraCookies: string[]): string {
    const cookies: string[] = [];

    if (electronCookies && electronCookies.length > 0) {
      for (const cookie of electronCookies) {
        if (cookie.name && cookie.value) {
          cookies.push(`${cookie.name}=${cookie.value}`);
        }
      }
    }

    if (extraCookies && extraCookies.length > 0) {
      cookies.push(...extraCookies);
    }

    return cookies.join('; ');
  }

  public stalled = () => {
    if (this.mEnded) {
      return;
    }

    if (this.mRequest !== undefined) {
      if (this.mStallResets <= 0) {
        log('warn', 'giving up on download after repeated stalling with no progress', this.mUrl);
        const err = new StalledError();
        err['allowReport'] = false;
        return this.handleError(err);
      }

      log('info', 'download stalled, resetting connection',
          { url: this.mUrl, id: this.mJob.workerId });
      --this.mStallResets;

      this.mBuffers = [];

      this.mRedirected = true;
      this.mRequest.destroy();
      setTimeout(() => {
        this.mRedirected = false;
        this.mEnded = false;
        this.assignJob(this.mJob, this.mUrl);
      }, 200);
    } // the else case doesn't really make sense
  }

  private handleError = (err) => {
    if (this.mEnded) {
      return;
    }
    clearTimeout(this.mStallTimer);
    log('warn', 'chunk error',
        { 
          id: this.mJob.workerId, 
          err: err.message, 
          errorCode: err.code,
          ended: this.mEnded, 
          url: this.mUrl,
          networkRetries: this.mNetworkRetries,
          dataReceived: this.mDataHistory.length > 0
        });
    if (this.mJob.errorCB !== undefined) {
      this.mJob.errorCB(err);
    }
    if (this.mRequest !== undefined) {
      this.mRequest.destroy();
    }
    
    // Check for network errors that should trigger a retry
    const isNetworkError = ['ESOCKETTIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT'].includes(err.code)
      || err.message?.includes('socket hang up')
      || err.message?.includes('ECONNRESET')
      || err.message?.includes('ETIMEDOUT')
      || err.message?.includes('Request timeout');

    // For timeout errors, be more permissive - retry even without progress for initial connection issues
    const isTimeoutError = ['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(err.code) 
      || err.message?.includes('Request timeout')
      || err.message?.includes('ETIMEDOUT');
    
    const shouldRetry = isNetworkError && !this.mEnded && (
      this.mDataHistory.length > 0 || // Made progress before error
      isTimeoutError // Timeout errors should always retry
    );

    if (shouldRetry) {
      if (this.mNetworkRetries < DownloadWorker.MAX_NETWORK_RETRIES) {
        this.mNetworkRetries++;
        // Retry chunk after network error
        log('info', 'retrying chunk after network error', {
          id: this.mJob.workerId,
          errorCode: err.code,
          errorMessage: err.message,
          progressMade: this.mDataHistory.length > 0,
          isTimeoutError,
          retryAttempt: this.mNetworkRetries,
          maxRetries: DownloadWorker.MAX_NETWORK_RETRIES,
          url: this.mUrl
        });

        // Add a small delay before retrying to avoid hammering the server
        setTimeout(() => {
          if (!this.mEnded) {
            this.mJob.url().then(jobUrl => {
              this.assignJob(this.mJob, jobUrl);
            })
            .catch(innerErr => {
              this.handleError(innerErr);
            });
          }
        }, 1000 + Math.random() * 2000); // 1-3 second delay with jitter
      } else {
        log('warn', 'maximum network retries exceeded for chunk', {
          id: this.mJob.workerId,
          retries: this.mNetworkRetries,
          maxRetries: DownloadWorker.MAX_NETWORK_RETRIES
        });
        this.mEnded = true;
        this.mFinishCB(false);
      }
    } else {
      log('debug', 'not retrying chunk error', {
        id: this.mJob.workerId,
        errorCode: err.code,
        errorMessage: err.message,
        isNetworkError,
        isTimeoutError,
        shouldRetry,
        ended: this.mEnded,
        dataHistory: this.mDataHistory.length,
        networkRetries: this.mNetworkRetries,
        maxRetries: DownloadWorker.MAX_NETWORK_RETRIES
      });
      this.mEnded = true;
      this.mFinishCB(false);
    }
  }

  private abort = (paused: boolean): boolean => {
    if (this.mURLResolve !== undefined) {
      this.mURLResolve.cancel();
      this.mURLResolve = undefined;
    }
    this.mOnAbort?.();
    if (this.mEnded) {
      return false;
    }
    if (this.mRequest !== undefined) {
      this.mRequest.destroy();
    }
    this.mEnded = true;
    this.mFinishCB(paused);
    return true;
  }

  private handleHTML = (inputUrl: string) => {
    this.abort(false);
    if (this.mJob.errorCB !== undefined) {
      this.mJob.errorCB(new DownloadIsHTML(inputUrl));
    }
  }

  private handleComplete = (str?: stream.Readable) => {
    if (this.mEnded) {
      log('debug', 'chunk completed but can\'t write it anymore', JSON.stringify(this.mJob));
      return;
    }
    clearTimeout(this.mStallTimer);
    log('info', 'chunk completed', {
      id: this.mJob.workerId,
      numBuffers: this.mBuffers.length,
    });
    this.writeBuffer(str)
      .then(() => {
        if (this.mJob.completionCB !== undefined) {
          this.mJob.completionCB();
        }
        this.abort(false);
      })
      .catch(UserCanceled, () => null)
      .catch(ProcessCanceled, () => null)
      .catch(err => this.handleError(err));
  }

  private handleResponse = (response: http.IncomingMessage, jobUrl: string) => {
    // we're not handling redirections here. For one thing it may be undesired by the user
    // plus there might be a javascript redirect which we can't handle here anyway.
    // Instead we display the website as a download with a button where the user can open the
    // it. If it contains any redirect, the browser window will follow it and initiate a
    // download.
    if (response.statusCode >= 300) {
      if (([301, 302, 303, 307, 308].includes(response.statusCode))
          && (this.mRedirectsFollowed < MAX_REDIRECT_FOLLOW)) {
        const newUrl = url.resolve(jobUrl, response.headers['location'] as string);
        log('info', 'redirected', { newUrl, loc: response.headers['location'] });
        this.mJob.url = () => Bluebird.resolve(newUrl);
        this.mRedirected = true;

        if (response.headers['set-cookie'] !== undefined) {
          this.mJob.extraCookies = this.mJob.extraCookies
            .concat(response.headers['set-cookie']);
        }

        // delay the new request a bit to ensure the old request is completely settled
        // TODO: this is ugly and shouldn't be necessary if we made sure no state was neccessary to
        //   shut down the old connection
        setTimeout(() => {
          ++this.mRedirectsFollowed;
          this.mRedirected = false;
          // any data we may have gotten with the old reply is useless
          this.mJob.size += this.mJob.received;
          this.mJob.confirmedSize = this.mJob.size;
          this.mJob.offset -= this.mJob.received;
          this.mJob.confirmedOffset -= this.mJob.confirmedReceived;

          this.mJob.received = this.mJob.confirmedReceived = 0;
          this.mJob.state = 'running';
          this.mEnded = false;
          this.assignJob(this.mJob, newUrl);
        }, 100);
      } else {
        const err = new HTTPError(response.statusCode, response.statusMessage, jobUrl);
        err['attachLogOnReport'] = true;
        if (response.statusCode === 429) {
          err['allowReport'] = false;
        }
        this.handleError(err);
      }
      return;
    }

    this.mHeadersCB(response.headers);

    if (isHTMLHeader(response.headers)) {
      this.handleHTML(jobUrl);
      return;
    }

    const chunkable = 'content-range' in response.headers;

    log('debug', 'retrieving range',
        { id: this.mJob.workerId, range: response.headers['content-range'] || 'full' });
    if (this.mJob.responseCB !== undefined) {
      const chunkSize: number = (response.headers['content-length'] !== undefined)
        ? parseInt(response.headers['content-length'] as string, 10)
        : -1;

      let fileSize = chunkSize;
      if (chunkable) {
        const rangeExp: RegExp = /bytes (\d)*-(\d*)\/(\d*)/i;
        const sizeMatch: string[] = (response.headers['content-range'] as string).match(rangeExp);
        if ((sizeMatch?.length ?? 0) > 1) {
          fileSize = parseInt(sizeMatch[3], 10);
          const start = parseInt(sizeMatch[1], 10);
          if (!isNaN(start)) {
            // Align offset with server-confirmed start to avoid drift
            const delta = start - this.mJob.confirmedOffset;
            if (delta !== 0) {
              log('debug', 'aligning job offset with server content-range start', {
                workerId: this.mJob.workerId,
                prevConfirmedOffset: this.mJob.confirmedOffset,
                newStart: start,
              });
              this.mJob.offset = start + (this.mJob.offset - this.mJob.confirmedOffset);
              this.mJob.confirmedOffset = start;
            }
          }
        }
      } else {
        log('debug', 'download doesn\'t support partial requests');
        // download can't be resumed so the returned data will start at 0
        this.mJob.offset = 0;
      }
      if (chunkSize !== this.mJob.size) {
        // on the first request it's possible we requested more than the file size if
        // the file is smaller than the minimum size for chunking or - if the file isn't chunkable -
        // the request may be larger than what we requested initially.
        // offset should always be 0 here
        this.mJob.confirmedSize = this.mJob.size = chunkSize;
      }

      let fileName;
      if ('content-disposition' in response.headers) {
        let cd: string = response.headers['content-disposition'] as string;
        // the content-disposition library can't deal with trailing semi-colon so
        // we have to remove it before parsing
        // see https://github.com/jshttp/content-disposition/issues/19
        if (cd[cd.length - 1] === ';') {
          cd = cd.substring(0, cd.length - 1);
        }
        if (cd.startsWith('filename')) {
          cd = 'attachment;' + cd;
        }
        try {
          const disposition = contentDisposition.parse(cd);
          if (truthy(disposition.parameters['filename'])) {
            fileName = disposition.parameters['filename'];
          }
          log('debug', 'got file name', fileName);
        } catch (err) {
          log('warn', 'failed to parse content disposition', {
            'content-disposition': cd, message: err.message });
        }
      }
      this.mJob.responseCB(fileSize, fileName, chunkable);
    }
  }

  private mergeBuffers = (): Buffer => {
    const res = Buffer.concat(this.mBuffers.map(buffer => new Uint8Array(buffer)));
    this.mBuffers = [];
    return res;
  }

  private get bufferLength(): number {
    return this.mBuffers.reduce((prev, iter) => prev + iter.length, 0);
  }

  private doWriteBuffer = (buf: Buffer): Bluebird<void> => {
    const len = buf.length;
    const res = this.mJob.dataCB(this.mJob.offset, buf)
      .then(() => {
        this.mJob.confirmedReceived += len;
        this.mJob.confirmedOffset += len;
        this.mJob.confirmedSize -= len;
      });

    // need to update immediately, otherwise chunks might overwrite each other
    this.mJob.received += len;
    this.mJob.offset += len;
    this.mJob.size -= len;
    return res;
  }

  private writeBuffer = (str?: stream.Readable): Bluebird<void> => {
    if (this.mBuffers.length === 0) {
      return Bluebird.resolve();
    }

    let merged: Buffer;

    try {
      merged = this.mergeBuffers();
    } catch (err) {
      // we failed to merge the smaller buffers, probably a memory issue.
      log('warn', 'failed to merge buffers', { sizes: this.mBuffers.map(buf => buf.length) });
      // let's try to write the buffers individually
      const bufs = this.mBuffers;
      this.mBuffers = [];
      str?.pause?.();
      return Bluebird.mapSeries(bufs, buf => this.doWriteBuffer(buf))
        .then(() => {
          str?.resume?.();
        });
    }

    return this.doWriteBuffer(merged);
  }

  private handleData = (data: Buffer, str: stream.Readable) => {
    if (this.mEnded || ['paused', 'finished'].includes(this.mJob.state)) {
      log('debug', 'got data after ended',
          { workerId: this.mJob.workerId, ended: this.mEnded, destroyed: this.mRequest.destroyed });
      this.mRequest.destroy();
      return;
    }

    if (this.mRedirected) {
      // ignore message body when we were redirected
      return;
    }

    this.mDataHistory.push({ time: Date.now(), size: data.byteLength });
    this.mBuffers.push(data);

    // Reset network retry counter since we're successfully receiving data
    this.mNetworkRetries = 0;

    const bufferLength = this.bufferLength;
    if (bufferLength >= DownloadWorker.BUFFER_SIZE) {
      if (!this.mWriting) {
        this.mWriting = true;
        this.writeBuffer(str)
          .catch(UserCanceled, () => null)
          .catch(ProcessCanceled, () => null)
          .catch(err => {
            this.handleError(err);
          })
          .then(() => {
            this.mWriting = false;
            if (this.mResponse.isPaused()) {
              this.mResponse.resume();
            }
          });
        this.mProgressCB(bufferLength);
      } else if (bufferLength >= DownloadWorker.BUFFER_SIZE_CAP) {
        // throttle the download because we can't process input fast enough and we
        // risk the memory usage to escalate
        this.mResponse.pause();
      }
    }
  }
}

// Configuration constants for slow worker handling
const SLOW_WORKER_THRESHOLD = 10;              // Number of "starving" measurements before considering restart
const SLOW_WORKER_MIN_AGE_MS = 10000;          // Minimum time (10s) before allowing restart
const SLOW_WORKER_RESTART_COOLDOWN_MS = 30000; // Cooldown period (30s) between restarts
const MAX_WORKER_RESTARTS = 3;                 // Maximum restarts per worker
const MAX_INTERNAL_AUTO_RESUMES = 5;           // Cap auto-resume cycles per job

/**
 * manages downloads
 *
 * @class DownloadManager
 */
class DownloadManager {
  private mMinChunkSize: number;
  private mMaxWorkers: number;
  private mMaxChunks: number;
  private mDownloadPath: string;
  private mBusyWorkers: { [id: number]: DownloadWorker } = {};
  private mSlowWorkers: { [id: number]: number } = {};
  private mWorkerRestartCounts: { [id: number]: number } = {};
  private mWorkerLastRestart: { [id: number]: number } = {};
  private mQueue: IRunningDownload[] = [];
  private mNextId: number = 0;
  private mSpeedCalculator: SpeedCalculator;
  private mUserAgent: string;
  private mProtocolHandlers: IProtocolHandlers;
  private mResolveCache: { [url: string]: { time: number, urls: string[], meta: any } } = {};
  private mFileExistsCB: (fileName: string) => Bluebird<boolean>;
  private mThrottle: () => stream.Transform;
  private mHttpAgent: http.Agent;
  private mHttpsAgent: https.Agent;

  /**
   * Creates an instance of DownloadManager.
   *
   * @param {string} downloadPath default path to download to if the enqueue command doesn't
   *                 specify otherwise
   * @param {number} maxWorkers maximum number of workers downloading data at once. should be bigger
   *                            than maxChunks
   * @param {number} maxChunks maximum number of chunks per file being downloaded at once
   *
   * @memberOf DownloadManager
   */
  constructor(downloadPath: string, maxWorkers: number, maxChunks: number,
              speedCB: (speed: number) => void, userAgent: string,
              protocolHandlers: IProtocolHandlers,
              maxBandwidth: () => number) {
    // hard coded chunk size but I doubt this needs to be customized by the user
    this.mMinChunkSize = 20 * 1024 * 1024;
    this.mDownloadPath = downloadPath;
    this.mMaxWorkers = maxWorkers;
    this.mMaxChunks = maxChunks;
    this.mUserAgent = userAgent;

    // Initialize persistent connection agents for better download performance
    this.mHttpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: maxWorkers * 2, // Allow more sockets than workers for better concurrency
      maxFreeSockets: maxWorkers,
      timeout: 120000,
    });

    this.mHttpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: maxWorkers * 2,
      maxFreeSockets: maxWorkers,
      timeout: 120000,
    });
    
    const speedCalcCB = (speed: number) => {
      speedCB(speed);
    }
    setInterval(() => this.tickQueue(false), 200);
    this.mSpeedCalculator = new SpeedCalculator(5, speedCalcCB);
    this.mProtocolHandlers = protocolHandlers;
    this.mThrottle = () => makeThrottle(maxBandwidth);
  }

  public setFileExistsCB = (cb: (fileName: string) => Bluebird<boolean>) => {
    this.mFileExistsCB = cb;
  }

  public setDownloadPath = (downloadPath: string) => {
    this.mDownloadPath = downloadPath;
  }

  /**
   * Get the appropriate HTTP agent based on protocol for persistent connections
   */
  private getAgent(protocol: string): http.Agent | https.Agent {
    return protocol === 'https:' ? this.mHttpsAgent : this.mHttpAgent;
  }

  /**
   * Clean up persistent connection agents
   */
  public cleanup(): void {
    if (this.mHttpAgent) {
      this.mHttpAgent.destroy();
    }
    if (this.mHttpsAgent) {
      this.mHttpsAgent.destroy();
    }
  }

  public setMaxConcurrentDownloads = (maxConcurrent: number) => {
    this.mMaxWorkers = maxConcurrent;
  }

  public getFreeSlots = (): number => {
    const busyWorkerIds = Object.keys(this.mBusyWorkers);
    const busyCount = busyWorkerIds.reduce((count, key) => {
      const worker = this.mBusyWorkers[key];
      return count + ((this.mSlowWorkers[key] == null && !worker.isPending()) ? 1 : 0);
    }, 0);
    return Math.max(this.mMaxWorkers - busyCount, 0);
  }

  /**
   * enqueues a download
   *
   * @param {string[]} urls
   * @param {(received: number, total: number) => void} progressCB
   * @param {string} [destinationPath]
   * @returns {Bluebird<string>}
   *
   * @memberOf DownloadManager
   */
  public enqueue = (id: string, urls: string[],
                 fileName: string,
                 progressCB: ProgressCallback,
                 destinationPath?: string,
                 options?: IDownloadOptions): Bluebird<IDownloadResult> => {
    if (urls.length === 0) {
      return Bluebird.reject(new Error('No download urls'));
    }
    log('info', 'queueing download', id);
    let nameTemplate: string;
    let baseUrl: string;
    try {
      baseUrl = urls[0].split('<')[0];
      nameTemplate = fileName || decodeURI(path.basename(url.parse(baseUrl).pathname));
    } catch (err) {
      return Bluebird.reject(new ProcessCanceled(`failed to parse url "${baseUrl}"`));
    }
    const destPath = destinationPath || this.mDownloadPath;
    let download: IRunningDownload;
    return fs.ensureDirAsync(destPath)
      .then(() => (options.redownload === 'replace')
        ? fs.removeAsync(path.join(destPath, nameTemplate))
            .catch(err => {
              log('debug', 'failed to remove archive expected to be replaced', err);
              return Bluebird.resolve();
            })
        : Bluebird.resolve())
      .then(() => this.unusedName(destPath, nameTemplate || 'deferred', options.redownload, id))
      .then((filePath: string) =>
        new Bluebird<IDownloadResult>((resolve, reject) => {
          download = {
            id,
            origName: nameTemplate,
            tempName: filePath,
            finalName: (fileName !== undefined)
              ? Bluebird.resolve(path.join(destPath, path.basename(filePath))) : undefined,
            error: false,
            urls,
            resolvedUrls: this.resolveUrls(urls, nameTemplate, options?.nameHint),
            options,
            started: new Date(),
            lastProgressSent: 0,
            received: 0,
            chunks: [],
            chunkable: undefined,
            progressCB,
            finishCB: resolve,
            failedCB: err => {
              reject(err);
            },
            promises: [],
          };
          download.chunks.push(this.initChunk(download));
          this.mQueue.push(download);
          progressCB(0, undefined,
                     download.chunks.map(this.toStoredChunk), download.chunkable,
                     undefined, filePath);
        }))
      .finally(() => {
        if (download?.assembler !== undefined) {
          download.assembler.close()
            .catch(() => null);
        }
      });
  }

  public resume = (id: string,
                filePath: string,
                urls: string[],
                received: number,
                size: number,
                started: number,
                chunks: IChunk[],
                progressCB: ProgressCallback,
                options?: IDownloadOptions): Bluebird<IDownloadResult> => {
    if (options === undefined) {
      options = {};
    }
    if (options.redownload === undefined) {
      // we don't know what this was set to initially but going to assume that it was always
      // or the user said yes, otherwise why is this resumable and not canceled?
      options.redownload = 'always';
    }
    return new Bluebird<IDownloadResult>((resolve, reject) => {
      const download: IRunningDownload = {
        id,
        origName: path.basename(filePath),
        tempName: filePath,
        error: false,
        urls,
        resolvedUrls: this.resolveUrls(urls, path.basename(filePath), options?.nameHint),
        options,
        lastProgressSent: 0,
        received,
        size,
        started: new Date(started),
        chunks: [],
        chunkable: undefined,
        progressCB,
        finishCB: resolve,
        failedCB: (err) => {
          reject(err);
        },
        promises: [],
      };
      const isPending = received === 0;
      download.chunks = (chunks || [])
        .map((chunk, idx) => this.toJob(download, chunk, isPending && (idx === 0)));
      if (download.chunks.length > 0) {
        download.chunks[0].errorCB = (err) => { this.cancelDownload(download, err); };
        this.mQueue.push(download);
      } else {
        return reject(new ProcessCanceled('No unfinished chunks'));
      }
    });
  }

  /**
   * cancels a download. This stops the download but doesn't remove the file
   * This call does not wait for the download to actually be stopped, it merely
   * sends the signal to stop it
   *
   * @param {string} id
   * @returns true if the download was stopped, false if something went wrong. In this case
   *               the caller should not expect a callback about the download being terminated
   *
   * @memberOf DownloadManager
   */
  public stop = (id: string): boolean => {
    const download: IRunningDownload = this.mQueue.find(
      (value: IRunningDownload) => value.id === id);
    if (download === undefined) {
      log('warn', 'failed to cancel download, not found', { id });
      return false;
    }
    log('info', 'stopping download', { id });

    // first, make sure not-yet-started chunks are paused, otherwise
    // they might get started as we stop running chunks as that frees
    // space in the queue
    download.chunks.forEach((chunk: IDownloadJob) => {
      if (chunk.state === 'init') {
        chunk.state = 'finished';
      }
    });

    // stop running workers
    download.chunks.forEach((chunk: IDownloadJob) => {
      if ((chunk.state === 'running')
          && (this.mBusyWorkers[chunk.workerId] !== undefined)) {
        this.mBusyWorkers[chunk.workerId].cancel();
      }
    });
    // remove from queue
    this.mQueue = this.mQueue.filter(
      (value: IRunningDownload) => value.id !== id);

    return true;
  }

  public pause = (id: string) => {
    const download: IRunningDownload = this.mQueue.find(
      (value: IRunningDownload) => value.id === id);
    if (download === undefined) {
      // this indicates the download isn't queued, so effectively it's already
      // paused
      log('warn', 'failed to pause download, not found', { id });
      return undefined;
    }
    log('info', 'pause download', { id });

    const unfinishedChunks: IChunk[] = [];

    // first, make sure not-yet-started chunks are paused, otherwise
    // they might get started as we stop running chunks as that frees
    // space in the queue
    download.chunks.forEach((chunk: IDownloadJob) => {
      if (chunk.state === 'init') {
        chunk.state = 'paused';
      }
    });

    // stop running workers
    download.chunks.forEach((chunk: IDownloadJob) => {
      if (['running', 'paused'].includes(chunk.state) && (chunk.size > 0)) {
        unfinishedChunks.push({
          received: chunk.confirmedReceived,
          offset: chunk.confirmedOffset,
          size: chunk.confirmedSize,
          url: chunk.url,
        });
        if (this.mBusyWorkers[chunk.workerId] !== undefined) {
          this.mBusyWorkers[chunk.workerId].pause();
          this.stopWorker(chunk.workerId);
        }
      }
    });
    // remove from queue
    this.mQueue = this.mQueue.filter(
      (value: IRunningDownload) => value.id !== id);

    return unfinishedChunks;
  }

  private resolveUrl = (input: string,
                     name: string,
                     friendlyName: string)
                     : Bluebird<IResolvedURL> => {
    if ((this.mResolveCache[input] !== undefined)
      && ((Date.now() - this.mResolveCache[input].time) < URL_RESOLVE_EXPIRE_MS)) {
      const cache = this.mResolveCache[input];
      return Bluebird.resolve({ urls: cache.urls, meta: cache.meta });
    }
    const protocol = url.parse(input).protocol;
    if (!truthy(protocol)) {
      return Bluebird.resolve({ urls: [], meta: {} });
    }
    const handler = this.mProtocolHandlers[protocol.slice(0, protocol.length - 1)];

    return (handler !== undefined)
      ? handler(input, name, friendlyName)
        .then(res => {
          this.mResolveCache[input] = { time: Date.now(), urls: res.urls, meta: res.meta };
          return res;
        })
      : Bluebird.resolve({ urls: [input], meta: {} });
  }

  private resolveUrls = (urls: string[],
                      name: string,
                      friendlyName: string)
                      : () => Bluebird<IResolvedURLs> => {
    let cache: Bluebird<{ result: IResolvedURLs, error: Error }>;

    return () => {
      if (cache === undefined) {
        let error: Error;
        // TODO: Does it make sense here to resolve all urls?
        //   For all we know they could resolve to an empty list so
        //   it wouldn't be enough to just one source url
        cache = Bluebird.reduce(urls, (prev, iter) => {
          return this.resolveUrl(iter, name, friendlyName)
            .then(resolved => {
              return Bluebird.resolve({
                urls: [...prev.urls, ...resolved.urls],
                meta: _.merge(prev.meta, resolved.meta),
                updatedUrls: [...prev.updatedUrls, resolved.updatedUrl || iter],
              });
            })
            .catch(Error, err => {
              error = err;
              return Bluebird.resolve(prev);
            });
        }, { urls: [], meta: {}, updatedUrls: [] })
        .then(result => {
          return { result, error };
        });
      }
      return cache.then(({ result, error }) => {
        if ((result.urls.length === 0) && (error !== undefined)) {
          return Bluebird.reject(error);
        } else {
          return Bluebird.resolve(result);
        }
      });
    };
  }

  private initChunk = (download: IRunningDownload): IDownloadJob => {
    let fileNameFromURL: string;
    return {
      url: () => download.resolvedUrls()
        .then(resolved => {
          if (resolved.updatedUrls !== undefined) {
            download.urls = resolved.updatedUrls;
          }
          if ((fileNameFromURL === undefined) && (resolved.urls.length > 0)) {
            const [urlIn, fileName] = resolved.urls[0].split('<')[0].split('|');
            fileNameFromURL = (fileName !== undefined)
              ? fileName
              : decodeURI(path.basename(url.parse(urlIn).pathname));
          }
          return resolved.urls[0];
        }),
      confirmedOffset: 0,
      confirmedSize: this.mMinChunkSize,
      confirmedReceived: 0,
      offset: 0,
      state: 'init',
      restartCount: 0,
      received: 0,
      size: this.mMinChunkSize,
      options: download.options,
      extraCookies: [],
      errorCB: (err) => { this.cancelDownload(download, err); },
      responseCB: (size: number, fileName: string, chunkable: boolean) =>
        this.updateDownload(download, size, fileName || fileNameFromURL, chunkable),
    };
  }

  private cancelDownload = (download: IRunningDownload, err: Error) => {
    for (const chunk of download.chunks) {
      if (chunk.state === 'running') {
        if (this.mBusyWorkers[chunk.workerId] !== undefined) {
          this.mBusyWorkers[chunk.workerId].cancel();
        }
        chunk.state = 'paused';
      }
    }
    download.failedCB(err);
  }

  private tickQueue(verbose: boolean = true) {
    let busyWorkerIds = Object.keys(this.mBusyWorkers);
    let busyCount = busyWorkerIds.reduce((count, key) => {
      const worker = this.mBusyWorkers[key];
      return count + ((this.mSlowWorkers[key] == null && !worker.isPending()) ? 1 : 0);
    }, 0);
    let freeSpots = Math.max(this.mMaxWorkers - busyCount, 0);

    if (verbose && this.mQueue.length > 0) {
      // Debug: Log the state of each download in the queue
      
      log('info', 'tick dl queue', { 
        freeSpots, 
        queueLength: this.mQueue.length, 
        busyCount,
      });
    }

    // Categorize downloads for optimized processing
    const singleChunkDownloads: IRunningDownload[] = this.mQueue.filter(item => item.chunks.length === 1 || !item.chunkable);
    const multiChunkDownloads: IRunningDownload[] = this.mQueue.filter(item => item.chunks.length > 1 && item.chunkable);

    // Prioritize single-chunk downloads first - start them concurrently
    const singleChunkPromises: Bluebird<void>[] = [];
    let singleChunkSlotsUsed = 0;
    for (let idx = 0; idx < singleChunkDownloads.length && singleChunkSlotsUsed < freeSpots; idx++) {
      const queueItem = singleChunkDownloads[idx];

      // Skip downloads that are already finished (they'll be cleaned up later)
      if (queueItem.chunks.every(chunk => chunk.state === 'finished')) {
        continue;
      }

      const unstartedChunks = queueItem.chunks.filter(chunk => chunk.state === 'init');
      const pausedChunks = queueItem.chunks.filter(chunk => chunk.state === 'paused');
      pausedChunks.forEach(chunk => chunk.state = 'init');
      const totalUnstarted = unstartedChunks.concat(pausedChunks);

      if (totalUnstarted.length === 0) continue;

      const workerPromise = this.startWorker(queueItem).catch(err => {
        log('error', 'failed to start single-chunk download worker', {
          downloadId: queueItem.id,
          error: err.message
        });
        // Don't modify the queue here, let cleanup handle it
        queueItem.failedCB(err);
      });
      singleChunkPromises.push(workerPromise);
      singleChunkSlotsUsed++;
    }

    // Update free spots after accounting for single-chunk downloads
    freeSpots = Math.max(freeSpots - singleChunkSlotsUsed, 0);

    const multiChunkPromises: Bluebird<void>[] = [];
    for (const queueItem of multiChunkDownloads) {
      if (freeSpots <= 0) break;
      const finishedChunks = queueItem.chunks.filter(chunk => chunk.state === 'finished');
      
      // Skip downloads that are already finished (they'll be cleaned up later)
      if (finishedChunks.length === queueItem.chunks.length) {
        continue;
      }
      const unstartedChunks = queueItem.chunks.filter(chunk => chunk.state === 'init');

      // Start as many chunks as we have free spots for this download
      const chunksToStart = Math.min(unstartedChunks.length, freeSpots);
      for (let chunkIdx = 0; chunkIdx < chunksToStart; chunkIdx++) {
        const workerPromise = this.startWorker(queueItem).catch(err => {
          // For multi-chunk downloads, be more resilient - don't fail the entire download
          // if one chunk fails to start, unless it's the first/only chunk
          if (queueItem.chunks.length === 1 || chunkIdx === 0) {
            log('error', 'failed to start critical chunk for multi-chunk download', {
              downloadId: queueItem.id,
              chunkIndex: chunkIdx,
              error: err.message
            });
            // Don't modify the queue here, let cleanup handle it
            queueItem.failedCB(err);
          } else {
            log('warn', 'failed to start chunk for multi-chunk download', {
              downloadId: queueItem.id,
              chunkIndex: chunkIdx,
              error: err.message
            });
            // Mark this specific chunk as failed/paused rather than failing the entire download
            if (chunkIdx < unstartedChunks.length) {
              unstartedChunks[chunkIdx].state = 'paused';
            }
          }
        });
        multiChunkPromises.push(workerPromise);
      }
      freeSpots -= chunksToStart;
    }

    // Clean up completed downloads at the end of tickQueue
    this.cleanupCompletedDownloads();
  }

  private cleanupCompletedDownloads() {
    // Defer cleanup to prevent blocking the tick queue
    setImmediate(() => {
      // Remove downloads that are fully completed or failed from the queue
      this.mQueue = this.mQueue.filter(download => {
        // Check if all chunks are finished
        const allChunksFinished = download.chunks.every(chunk => chunk.state === 'finished');
        // Check if download has any active or pending chunks
        const hasActiveChunks = download.chunks.some(chunk =>
          chunk.state === 'running' || chunk.state === 'init'
        );
        // Check if download has been sitting with only paused chunks for too long
        const onlyPausedChunks = download.chunks.every(chunk =>
          chunk.state === 'paused' || chunk.state === 'finished'
        );

        const shouldRemove = allChunksFinished || (!hasActiveChunks && onlyPausedChunks);
        
        return !shouldRemove;
      });
    });
  }

  private startWorker = (download: IRunningDownload) => {
    const workerId: number = this.mNextId++;
    this.mSpeedCalculator.initCounter(workerId);

    const job: IDownloadJob = download.chunks.find(ele => ele.state === 'init');
    if (!job) {
      // No init chunks? no problem.
      return Bluebird.resolve();
    }
    job.state = 'running';
    job.workerId = workerId;

    return this.startJob(download, job)
      .catch(err => {
        // If startJob fails, reset the job state and clean up
        log('warn', 'Failed to start worker, resetting job state', {
          workerId,
          downloadId: download.id,
          error: err.message
        });
        
        // Reset job state to allow retry
        job.state = 'paused';
        
        // Clean up speed calculator
        this.mSpeedCalculator.stopCounter(workerId);
        
        // Re-throw the error to bubble up to the caller
        throw err;
      });
  }

  private makeProgressCB = (job: IDownloadJob, download: IRunningDownload) => {
    return (bytes) => {
      const starving = this.mSpeedCalculator.addMeasure(job.workerId, bytes);
      if (starving) {
        this.mSlowWorkers[job.workerId] = (this.mSlowWorkers[job.workerId] || 0) + 1;
        if (this.shouldRestartSlowWorker(job.workerId, download)) {
          log('debug', 'restarting slow worker', {
            workerId: job.workerId,
            slowCount: this.mSlowWorkers[job.workerId],
            restartCount: this.mWorkerRestartCounts[job.workerId] || 0,
            downloadAge: Date.now() - download.started.getTime()
          });

          if (this.mBusyWorkers[job.workerId]) {
            this.mBusyWorkers[job.workerId].restart();

            this.mWorkerRestartCounts[job.workerId] = (this.mWorkerRestartCounts[job.workerId] || 0) + 1;
            this.mWorkerLastRestart[job.workerId] = Date.now();

            delete this.mSlowWorkers[job.workerId];
          } else {
            log('warn', 'attempted to restart non-existent worker', { workerId: job.workerId });
          }
        }
      } else if (starving === false) {
        // Worker is performing well, clear slow status
        delete this.mSlowWorkers[job.workerId];
      }
    };
  }

  private shouldRestartSlowWorker(workerId: number, download: IRunningDownload): boolean {
    const slowCount = this.mSlowWorkers[workerId] || 0;
    const restartCount = this.mWorkerRestartCounts[workerId] || 0;
    const lastRestart = this.mWorkerLastRestart[workerId] || 0;
    const downloadAge = Date.now() - download.started.getTime();
    const timeSinceLastRestart = Date.now() - lastRestart;

    // Don't restart if:
    // 1. Slow count hasn't reached threshold
    // 2. Download is too young (less than minimum age)
    // 3. Too many restarts already
    // 4. Not enough time since last restart (cooldown period)
    if (slowCount < SLOW_WORKER_THRESHOLD) {
      return false;
    }

    if (downloadAge < SLOW_WORKER_MIN_AGE_MS) {
      return false;
    }

    if (restartCount >= MAX_WORKER_RESTARTS) {
      log('debug', 'worker has reached maximum restart limit', {
        workerId,
        restartCount,
        maxRestarts: MAX_WORKER_RESTARTS
      });
      return false;
    }

    if (lastRestart > 0 && timeSinceLastRestart < SLOW_WORKER_RESTART_COOLDOWN_MS) {
      return false;
    }

    return true;
  }

  private startJob = (download: IRunningDownload, job: IDownloadJob) => {
    if (download.assemblerProm === undefined) {
      download.assemblerProm = FileAssembler.create(download.tempName)
        .tap(assembler => assembler.setTotalSize(download.size));
    }

    job.dataCB = this.makeDataCB(download);

    let stopped: boolean = false;

    // Reserve the spot with a simple placeholder object to prevent other workers 
    // from using this slot while the FileAssembler is being created
    const placeholder = {
      isPending: () => true,
      ended: () => false,
      cancel: () => { stopped = true; },
      pause: () => { stopped = true; }
    };
    this.mBusyWorkers[job.workerId] = placeholder as any;

    return download.assemblerProm.then(assembler => {
      if (stopped) {
        // Clean up the placeholder and reject
        delete this.mBusyWorkers[job.workerId];
        return Bluebird.reject(new UserCanceled(true));
      }
      download.assembler = assembler;

      const worker = new DownloadWorker(job, this.makeProgressCB(job, download),
        (pause, replaceFileName) => replaceFileName !== undefined
          ? this.useExistingFile(download, job, replaceFileName)
          : this.finishChunk(download, job, pause),
        (headers) => download.headers = headers,
        this.mUserAgent,
        this.mThrottle,
        this.getAgent.bind(this));

      this.mBusyWorkers[job.workerId] = worker;
      return Bluebird.resolve();
    })
    .catch((err) => {
      // Clean up the worker and reset job state on failure
      delete this.mBusyWorkers[job.workerId];
      job.state = 'paused';
      if (err.code === 'EBUSY') {
        return Bluebird.reject(new ProcessCanceled('output file is locked'));
      } else {
        return Bluebird.reject(err);
      }
    });
  }

  private makeDataCB = (download: IRunningDownload) => {
    let lastProgressUpdate = 0;
    let pendingProgressUpdate = false;

    return (offset: number, data: Buffer) => {
      if (isNaN(download.received)) {
        download.received = 0;
      }
      if (download.assembler.isClosed()) {
        return Bluebird.reject(new ProcessCanceled('file already closed'));
      }
      // these values will change until the data was written to file
      // so copy them so we write the correct info to state
      const receivedNow = download.received;
      return download.assembler.addChunk(offset, data)
        .then((synced: boolean) => {
          const urls: string[] = Array.isArray(download.urls) ? download.urls : undefined;
          download.received += data.byteLength;
          if (download.received > download.size) {
            download.size = download.received;
          }

          // Throttle progress updates to reduce UI blocking
          const now = Date.now();
          const shouldUpdate = synced || (now - lastProgressUpdate > 1000); // Update max once per second

          if (shouldUpdate && !pendingProgressUpdate) {
            lastProgressUpdate = now;
            pendingProgressUpdate = true;

            // Defer progress callback to prevent blocking file operations
            setImmediate(() => {
              pendingProgressUpdate = false;
              download.progressCB(
                  receivedNow, download.size,
                  synced
                    ? download.chunks.map(this.toStoredChunk)
                    : undefined,
                  download.chunkable,
                  urls,
                  download.tempName);
            });
          }
          return Bluebird.resolve(synced);
        })
        .catch(err => {
          if (!(err instanceof ProcessCanceled)) {
            for (const chunk of download.chunks) {
              if (chunk.state === 'running') {
                this.mBusyWorkers[chunk.workerId].cancel();
              }
            }
            download.failedCB(err);
          }
          return Bluebird.reject(err);
        });
    };
  }

  private updateDownloadSize = (download: IRunningDownload, size: number, chunkable: boolean) => {
    if (download.size !== size) {
      download.size = size;
      download.assembler.setTotalSize(size);
    }
    if (chunkable || (download.chunkable === null) || (download.chunkable === undefined)) {
      download.chunkable = chunkable;
    }
  }

  private updateDownload = (download: IRunningDownload, fileSize: number,
                         fileName: string, chunkable: boolean) => {
    if ((fileName !== undefined)
        && (fileName !== download.origName)
        && (download.finalName === undefined)) {
      // when the download has already been started we ignore the redownload option
      // to determine the correct name
      const newName = this.unusedName(path.dirname(download.tempName), fileName, 'always', download.id);
      download.finalName = newName;
      newName.then(resolvedName => {
        if (!download.assembler.isClosed()) {
          const oldTempName = download.tempName;
          download.tempName = resolvedName;
          return download.assembler.rename(resolvedName)
            .then(() => {
              download.finalName = newName;
            })
            .catch(err => {
              // if we failed to rename we will try to continue writing to the original file
              // so reset to the original name and remove the temporary one that got reserved
              // for the rename
              download.tempName = oldTempName;
              return fs.removeAsync(resolvedName)
                .catch(() => null)
                .then(() => Bluebird.reject(err));
            });
        }
      })
      .catch(err => {
        log('error', 'failed to update download name',
            { error: err.message, fileName, old: download.origName });
      });
    }

    if (chunkable || (download.chunkable === null) || (download.chunkable === undefined)) {
      download.chunkable = chunkable;
    }

    if (download.size !== fileSize) {
      download.size = fileSize;
      download.assembler.setTotalSize(fileSize);
    }

    if (download.chunks.length > 1) {
      return;
    }

    if ((fileSize > this.mMinChunkSize) && chunkable) {
      // download the file in chunks. We use a fixed number of variable size chunks.
      // Since the download link may expire we need to start all threads asap

      const remainingSize = fileSize - this.mMinChunkSize;

      const maxChunks = Math.min(this.mMaxChunks, this.mMaxWorkers);

      const chunkSize = Math.min(remainingSize,
          Math.max(this.mMinChunkSize, Math.ceil(remainingSize / maxChunks)));

      let offset = this.mMinChunkSize;
      while (offset < fileSize) {
        const previousChunk = download.chunks.find(chunk => chunk.extraCookies.length > 0);
        const extraCookies = (previousChunk !== undefined)
          ? previousChunk.extraCookies
          : [];

        const minSize = Math.min(chunkSize, fileSize - offset);
        download.chunks.push({
          confirmedReceived: 0,
          confirmedOffset: offset,
          confirmedSize: minSize,
          received: 0,
          offset,
          size: minSize,
          state: 'init',
          options: download.options,
          extraCookies,
          url: () => download.resolvedUrls().then(resolved => resolved.urls[0]),
        });
        offset += chunkSize;
      }
      log('debug', 'downloading file in chunks',
        { size: chunkSize, count: download.chunks.length, max: maxChunks, total: fileSize });
    } else {
      log('debug', 'download not chunked (no server support or it\'s too small)',
        { name: download.finalName, size: fileSize });
    }
  }

  private toStoredChunk = (job: IDownloadJob): IChunk => {
    return {
      url: job.url,
      size: job.confirmedSize,
      offset: job.confirmedOffset,
      received: job.confirmedReceived,
    };
  }

  private toJob = (download: IRunningDownload, chunk: IChunk, first: boolean): IDownloadJob => {
    let fileNameFromURL: string;
    const job: IDownloadJob = {
      url: () => download.resolvedUrls().then(resolved => {
        if ((fileNameFromURL === undefined) && (resolved.urls.length > 0)) {
          fileNameFromURL = decodeURI(path.basename(url.parse(resolved.urls[0]).pathname));
        }

        return resolved.urls[0];
      }),
      confirmedOffset: chunk.offset,
      confirmedSize: chunk.size,
      confirmedReceived: chunk.received,
      offset: chunk.offset,
      state: 'init',
      restartCount: 0,
      size: chunk.size,
      received: chunk.received,
      options: download.options,
      extraCookies: [],
      responseCB: first
        ? (size: number, fileName: string, chunkable: boolean) =>
            this.updateDownload(download, size, fileName || fileNameFromURL, chunkable)
        : (size: number, fileName: string, chunkable: boolean) =>
            this.updateDownloadSize(download, size, chunkable),
    };
    if (download.size === undefined) {
      // if the size isn't known yet, use the first job response to update it
      job.responseCB = (size: number, fileName: string, chunkable: boolean) =>
        this.updateDownload(download, size, fileName, chunkable);
    }
    return job;
  }

  private useExistingFile = (download: IRunningDownload, job: IDownloadJob, fileName: string) => {
    this.stopWorker(job.workerId);
    log('debug', 'using existing file for download',
        { download: download.id, fileName, oldName: download.tempName });
    job.state = 'finished';
    const downloadPath = path.dirname(download.tempName);
    const filePath = path.join(downloadPath, fileName);
    download.assembler.close()
      .then(() => fs.removeAsync(download.tempName)
        .catch(err => (err.code !== 'ENOENT')
          ? Bluebird.reject(err)
          : Bluebird.resolve()))
      .then(() => fs.statAsync(filePath + '.tmp'))
      .then(stat => {
        download.progressCB(stat.size, stat.size, undefined, false, undefined, filePath);
        return fs.renameAsync(filePath + '.tmp', filePath)
          .then(() => stat.size);
      })
      .then((size: number) => {
        download.finishCB({
          filePath,
          headers: download.headers,
          unfinishedChunks: [],
          hadErrors: download.error,
          size,
          metaInfo: {},
        });
      })
      .catch(err => {
        download.failedCB(err);
      });
  }

  /**
   * gets called whenever a chunk runs to the end or is interrupted
   */
  private finishChunk = (download: IRunningDownload, job: IDownloadJob, paused: boolean) => {
    this.stopWorker(job.workerId);

    log('debug', 'stopping chunk worker',
      { paused, id: job.workerId, offset: job.offset, size: job.size });

    // Treat negative sizes (like -1) as completed, not as error conditions
    // Negative sizes typically indicate unknown/unlimited size that has completed
    const hasRemainingData = job.size > 0;

    job.state = (paused || hasRemainingData) ? 'paused' : 'finished';

    // If this wasn't an intentional pause and there is remaining data,
    // auto-resume internally by re-queuing paused chunks instead of finalizing.
    // This prevents the visible start -> pause -> resume cycle and retries in-place.
    if (!paused && hasRemainingData) {
      job.restartCount = (job.restartCount ?? 0) + 1;
      if (job.restartCount > MAX_INTERNAL_AUTO_RESUMES) {
        log('warn', 'auto-resume cap reached for chunk; finalizing with unfinishedChunks', {
          downloadId: download.id,
          workerId: job.workerId,
          restartCount: job.restartCount,
          maxResumes: MAX_INTERNAL_AUTO_RESUMES
        });
      } else {
        // Prefer re-queuing the current job only to avoid unnecessary restarts
        const hasOtherActive = download.chunks.some(
          (chunk: IDownloadJob) => (chunk !== job) && !['paused', 'finished'].includes(chunk.state)
        );
        log('info', 'auto-resuming current chunk internally', {
          downloadId: download.id,
          workerId: job.workerId,
          otherActive: hasOtherActive,
        });
        job.state = 'init';
        return; // Do not finalize; tickQueue will restart this chunk
      }
    }

    const activeChunk = download.chunks.find(
      (chunk: IDownloadJob) => !['paused', 'finished'].includes(chunk.state));

    if (activeChunk === undefined) {
      let finalPath = download.tempName;
      download.assembler.close()
        .then(() => {
          if (download.finalName !== undefined) {
            return download.finalName
            .then((resolvedPath: string) => {
              finalPath = resolvedPath;
              const received = download.chunks.filter(chunk => chunk.state === 'paused')
                ? download.received
                : download.size;
              download.progressCB(received, download.size, undefined,
                                  undefined, undefined, resolvedPath);
              if (download.tempName !== resolvedPath) {
                log('debug', 'renaming download', { from: download.tempName, to: resolvedPath });
                return fs.renameAsync(download.tempName, resolvedPath);
              } else {
                return Bluebird.resolve();
              }
            });
          } else if ((download.headers !== undefined)
                     && (download.headers['content-type'] !== undefined)
                     && (contentTypeStr(download.headers['content-type']) === 'text/html')
                     && !download.tempName.toLowerCase().endsWith('.html')) {
            // don't keep html files. It's possible handleHTML already deleted it though
            return fs.removeAsync(download.tempName)
              .catch(err => (err.code !== 'ENOENT')
                  ? Bluebird.reject(err)
                  : Bluebird.resolve());
          }
        })
        .catch(err => {
          download.failedCB(err);
        })
        .then(() => download.resolvedUrls().catch(() => ({ urls: [], meta: {} })))
        .then((resolved: IResolvedURLs) => {
          const unfinishedChunks = download.chunks
            .filter(chunk => chunk.state === 'paused')
            .map(this.toStoredChunk);
          download.finishCB({
            filePath: finalPath,
            headers: download.headers,
            unfinishedChunks,
            hadErrors: download.error,
            size: Math.max(download.size, download.received),
            metaInfo: resolved.meta,
          });
        });
    }
  }

  private stopWorker = (id: number) => {
    this.mSpeedCalculator.stopCounter(id);
    delete this.mBusyWorkers[id];
    delete this.mSlowWorkers[id];
    delete this.mWorkerRestartCounts[id];
    delete this.mWorkerLastRestart[id];
  }

  private sanitizeFilename(input: string): string {
    return input.replace(INVALID_FILENAME_RE, '_');
  }

  /**
   * finds and reserves a not-yet-used file name.
   * If the input filename is sample.txt then this function will try
   * sample.txt, sample.1.txt, sample.2.txt ... until an unused name is found.
   * That file is created empty in an atomic operation no other call to unusedName
   * will return the same file name.
   *
   * @param {string} destination
   * @param {string} fileName
   * @returns {Bluebird<string>}
   */
  private unusedName = (destination: string,
                     fileName: string,
                     redownload: RedownloadMode,
                     downloadId?: string): Bluebird<string> => {
    fileName = this.sanitizeFilename(fileName);
    if (fileName === '') {
      fileName = 'unnamed';
    }
    return new Bluebird<string>((resolve, reject) => {
      let fd = null;
      let counter = 0;
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      let first: boolean = true;
      let fullPath = path.join(destination, fileName);

      const loop = () => {
        fs.openAsync(fullPath, 'wx')
          .then((newFd) => {
            fd = newFd;
            return fs.closeAsync(newFd)
              .catch((err) => {
                // EBADF may be a non-issue. If it isn't we will notice when
                // we try to write to the file
                if (err.code !== 'EBADF') {
                  return Bluebird.reject(err);
                }
              });
          }).then(() => {
            resolve(fullPath);
          }).catch((err) => {
            ++counter;
            const tryName = `${base}.${counter}${ext}`;
            fullPath = path.join(destination, tryName);
            if (err.code === 'EEXIST') {
              if (first && this.mFileExistsCB !== undefined) {
                first = false;
                if (redownload === 'always') {
                  loop();
                } else if (redownload === 'never') {
                  return reject(new AlreadyDownloaded(fileName, downloadId));
                } else if (redownload === 'replace') {
                  return resolve(fullPath);
                } else {
                  this.mFileExistsCB(fileName)
                    .then((cont: boolean) => {
                      if (cont) {
                        loop();
                      } else {
                        return reject(new UserCanceled());
                      }
                    })
                    .catch(reject);
                }
              } else {
                loop();
              }
            } else {
              reject(err);
            }
          });
      };
      process.nextTick(loop);
    });
  }

}

export default DownloadManager;
