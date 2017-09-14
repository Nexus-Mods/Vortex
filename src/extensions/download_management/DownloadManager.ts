import Debouncer from '../../util/Debouncer';
import { countIf } from '../../util/util';
import { IChunk } from './types/IChunk';
import { IDownloadJob } from './types/IDownloadJob';
import { IDownloadResult } from './types/IDownloadResult';
import { ProgressCallback } from './types/ProgressCallback';

import FileAssembler from './FileAssembler';
import SpeedCalculator from './SpeedCalculator';

import * as Promise from 'bluebird';
import contentType = require('content-type');
import * as fs from 'fs-extra-promise';
import * as http from 'http';
import * as path from 'path';
import requestT = require('request');
import * as url from 'url';

import { log } from '../../util/log';

interface IRunningDownload {
  id: string;
  fd?: number;
  urls: string[];
  origName: string;
  tempName: string;
  finalName?: Promise<string>;
  lastProgressSent: number;
  received: number;
  size?: number;
  headers?: any;
  assembler?: FileAssembler;
  chunks: IDownloadJob[];
  promises: Array<Promise<any>>;
  progressCB?: ProgressCallback;
  finishCB: (res: IDownloadResult) => void;
  failedCB: (err) => void;
}

type FinishCallback = (paused: boolean) => void;

/**
 * a download worker. A worker is started to download one chunk of a file,
 * they are currently not reused.
 *
 * @class DownloadWorker
 */
class DownloadWorker {
  private static BUFFER_SIZE = 256 * 1024;
  private mJob: IDownloadJob;
  private mRequest: requestT.Request;
  private mProgressCB: (bytes: number) => void;
  private mFinishCB: FinishCallback;
  private mHeadersCB: (headers: any) => void;
  private mUserAgent: string;
  private mBuffer: NodeBuffer;

  constructor(job: IDownloadJob,
              progressCB: (bytes: number) => void,
              finishCB: FinishCallback,
              headersCB: (headers: any) => void,
              userAgent: string) {
    this.mProgressCB = progressCB;
    this.mFinishCB = finishCB;
    this.mHeadersCB = headersCB;
    this.mJob = job;
    this.mUserAgent = userAgent;
    this.assignJob(job);
  }

  public assignJob(job: IDownloadJob) {
    const request: typeof requestT = require('request');

    this.mRequest = request({
      method: 'GET',
      uri: job.url,
      headers: {
        Range: `bytes=${job.offset}-${job.offset + job.size}`,
        'User-Agent': this.mUserAgent,
      },
    })
    .on('error', (err) => this.handleError(err))
    .on('response', (response: http.IncomingMessage) => this.handleResponse(response))
    .on('complete', (response: http.IncomingMessage, body) => this.handleComplete(response, body))
    .on('data', (data) => this.handleData(data))
    ;
  }

  public cancel() {
    this.mRequest.abort();
    this.mFinishCB(false);
  }

  public pause() {
    this.mRequest.abort();
    this.mFinishCB(true);
  }

  private handleError(err) {
    if (this.mJob.errorCB !== undefined) {
      this.mJob.errorCB(err);
    }
    this.mRequest.abort();
    this.mFinishCB(false);
  }

  private handleComplete(response: http.IncomingMessage, body) {
    if (this.mBuffer !== undefined) {
      this.mJob.dataCB(this.mJob.offset, this.mBuffer);
      this.mJob.received += this.mBuffer.length;
      this.mJob.offset += this.mBuffer.length;
      this.mJob.size -= this.mBuffer.length;
      this.mProgressCB(this.mBuffer.length);
    }

    if (this.mJob.completionCB !== undefined) {
      this.mJob.completionCB();
    }
    this.mFinishCB(false);
  }

  private handleResponse(response: http.IncomingMessage) {
    // we're not handling redirections here. For one thing it may be undesired by the user
    // plus there might be a javascript redirect which we can't handle here anyway.
    // Instead we display the website as a download with a button where the user can open the
    // it. If it contains any redirect, the browser window will follow it and initiate a
    // download.
    if (response.statusCode >= 300) {
      this.handleError({ message: response.statusMessage, http_headers: response.headers });
      return;
    }

    this.mHeadersCB(response.headers);

    log('debug', 'retrieving range',
        { id: this.mJob.workerId, range: response.headers['content-range'] });
    if (this.mJob.responseCB !== undefined) {
      let size: number = parseInt(response.headers['content-length'] as string, 10);
      if ('content-range' in response.headers) {
        const rangeExp: RegExp = /bytes (\d)*-(\d*)\/(\d*)/i;
        const sizeMatch: string[] = (response.headers['content-range'] as string).match(rangeExp);
        if (sizeMatch.length > 1) {
          size = parseInt(sizeMatch[3], 10);
        }
      }

      let fileName;
      if ('content-disposition' in response.headers) {
        const fileNameExp: RegExp = /filename=(.*)/i;
        const nameMatch: string[] =
            (response.headers['content-disposition'] as string).match(fileNameExp);
        if (nameMatch.length > 1) {
          fileName = nameMatch[1];
        }
      }
      this.mJob.responseCB(size, fileName);
    }
  }

  private handleData(data) {
    if (this.mBuffer === undefined) {
      this.mBuffer = data;
    } else {
      this.mBuffer = Buffer.concat([ this.mBuffer, data ]);
      if (this.mBuffer.length >= DownloadWorker.BUFFER_SIZE) {
        this.mJob.dataCB(this.mJob.offset, this.mBuffer);
        this.mJob.received += this.mBuffer.length;
        this.mJob.offset += this.mBuffer.length;
        this.mJob.size -= this.mBuffer.length;
        this.mProgressCB(this.mBuffer.length);
        this.mBuffer = undefined;
      }
    }
  }
}

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
  private mQueue: IRunningDownload[] = [];
  private mPaused: IRunningDownload[] = [];
  private mNextId: number = 0;
  private mSpeedCalculator: SpeedCalculator;
  private mUserAgent: string;

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
              speedCB: (speed: number) => void, userAgent: string) {
    // hard coded chunk size but I doubt this needs to be customized by the user
    this.mMinChunkSize = 1024 * 1024;
    this.mDownloadPath = downloadPath;
    this.mMaxWorkers = maxWorkers;
    this.mMaxChunks = maxChunks;
    this.mUserAgent = userAgent;
    this.mSpeedCalculator = new SpeedCalculator(5, speedCB);
  }

  public setDownloadPath(downloadPath: string) {
    this.mDownloadPath = downloadPath;
  }

  public setMaxConcurrentDownloads(maxConcurrent: number) {
    this.mMaxWorkers = maxConcurrent;
  }

  /**
   * enqueues a download
   *
   * @param {string[]} urls
   * @param {(received: number, total: number) => void} progressCB
   * @param {string} [destinationPath]
   * @returns {Promise<string>}
   *
   * @memberOf DownloadManager
   */
  public enqueue(id: string, urls: string[], progressCB: ProgressCallback,
                 destinationPath?: string): Promise<IDownloadResult> {
    if (urls.length === 0) {
      return Promise.reject(new Error('No download urls'));
    }
    const nameTemplate: string = decodeURI(path.basename(url.parse(urls[0]).pathname));
    const destPath = destinationPath || this.mDownloadPath;
    return fs.ensureDirAsync(destPath)
      .then(() => this.unusedName(destPath, nameTemplate))
      .then((filePath: string) =>
        new Promise<IDownloadResult>((resolve, reject) => {
          const download: IRunningDownload = {
            id,
            origName: nameTemplate,
            tempName: filePath,
            urls,
            lastProgressSent: 0,
            received: 0,
            chunks: [],
            progressCB,
            finishCB: resolve,
            failedCB: (err) => {
              reject(err);
            },
            promises: [],
          };
          download.chunks.push(this.initChunk(download));
          this.mQueue.push(download);
          progressCB(0, undefined,
                     download.chunks.map(this.toStoredChunk), filePath);
          this.tickQueue();
        }));
  }

  public resume(id: string, filePath: string, urls: string[], received: number, size: number,
                chunks: IChunk[], progressCB: ProgressCallback): Promise<IDownloadResult> {
    return new Promise<IDownloadResult>((resolve, reject) => {
      const download: IRunningDownload = {
        id,
        origName: filePath,
        tempName: filePath,
        urls,
        lastProgressSent: 0,
        received,
        size,
        chunks: [],
        progressCB,
        finishCB: resolve,
        failedCB: (err) => {
          reject(err);
        },
        promises: [],
      };
      download.chunks = chunks.map(chunk => this.toJob(download, chunk));
      this.mQueue.push(download);
      this.tickQueue();
    });
  }

  /**
   * cancel a download. This stops the download but doesn't remove the file
   *
   * @param {string} id
   *
   * @memberOf DownloadManager
   */
  public stop(id: string) {
    const download: IRunningDownload = this.mQueue.find(
      (value: IRunningDownload) => value.id === id);
    if (download === undefined) {
      log('warn', 'failed to cancel download, not found', { id });
      return;
    }
    log('info', 'stopping download', { id });

    // stop running workers
    download.chunks.forEach((value: IDownloadJob) => {
      if (value.state === 'running') {
        this.mBusyWorkers[value.workerId].cancel();
      }
    });
    // remove from queue
    this.mQueue = this.mQueue.filter(
      (value: IRunningDownload) => value.id !== id);
  }

  public pause(id: string) {
    const download: IRunningDownload = this.mQueue.find(
      (value: IRunningDownload) => value.id === id);
    if (download === undefined) {
      log('warn', 'failed to pause download, not found', { id });
      return undefined;
    }
    log('info', 'pause download', { id });

    const unfinishedChunks: IChunk[] = [];

    // stop running workers
    download.chunks.forEach((value: IDownloadJob) => {
      if (value.state === 'running') {
        unfinishedChunks.push({
          received: value.received,
          offset: value.offset,
          size: value.size,
          url: value.url,
        });
        this.mBusyWorkers[value.workerId].pause();
        this.stopWorker(value.workerId);
      }
    });
    // remove from queue
    this.mQueue = this.mQueue.filter(
      (value: IRunningDownload) => value.id !== id);

    return unfinishedChunks;
  }

  private initChunk(download: IRunningDownload): IDownloadJob {
    return {
      url: download.urls[0],
      offset: 0,
      state: 'init',
      received: 0,
      size: this.mMinChunkSize,
      errorCB: (err) => { this.cancelDownload(download, err); },
      responseCB: (size: number, fileName: string) =>
        this.updateDownload(download, size, fileName),
    };
  }

  private cancelDownload(download: IRunningDownload, err) {
    for (const chunk of download.chunks) {
      if (chunk.state === 'running') {
        this.mBusyWorkers[chunk.workerId].cancel();
      }
    }
    download.failedCB(err);
  }

  private tickQueue() {
    let freeSpots: number = this.mMaxWorkers - Object.keys(this.mBusyWorkers).length;
    let idx = 0;
    while ((freeSpots > 0) && (idx < this.mQueue.length)) {
      let unstartedChunks = countIf(this.mQueue[idx].chunks, value => value.state === 'init');
      while ((freeSpots > 0) && (unstartedChunks > 0)) {
        try {
          this.startWorker(this.mQueue[idx]);
          --unstartedChunks;
          --freeSpots;
        } catch (err) {
          this.mQueue[idx].failedCB(err);
          this.mQueue.splice(idx, 1);
        }
      }
      ++idx;
    }
  }

  private startWorker(download: IRunningDownload) {
    const workerId: number = this.mNextId++;
    this.mSpeedCalculator.initCounter(workerId);
    const job: IDownloadJob = download.chunks.find(ele => ele.state === 'init');
    job.state = 'running';
    job.workerId = workerId;

    if (download.assembler === undefined) {
      try {
        download.assembler = new FileAssembler(download.tempName);
      } catch (err) {
        if (err.code === 'EBUSY') {
          throw new Error('output file is locked');
        } else {
          throw err;
        }
      }
      if (download.size) {
        download.assembler.setTotalSize(download.size);
      }
    }
    log('debug', 'start download worker',
      { name: download.tempName, workerId, size: job.size });
    job.dataCB = (offset: number, data: Buffer) => {
      if (isNaN(download.received)) {
        download.received = 0;
      }
      // these values will change until the data was written to file
      // so copy them so we write the correct info to state
      const receivedNow = download.received;
      download.assembler.addChunk(offset, data)
        .then((synced: boolean) => {
          download.received += data.byteLength;
          download.progressCB(
              receivedNow, download.size,
              synced
                ? download.chunks.map(this.toStoredChunk)
                : undefined,
              download.tempName);
        });
    };

    this.mBusyWorkers[workerId] = new DownloadWorker(job,
      (bytes) => {
        this.mSpeedCalculator.addMeasure(workerId, bytes);
      },
      (pause) => this.finishChunk(download, job, pause),
      (headers) => download.headers = headers,
      this.mUserAgent);
  }

  private updateDownload(download: IRunningDownload, size: number, fileName?: string) {
    if ((fileName !== undefined) && (fileName !== download.origName)) {
      download.finalName = this.unusedName(path.dirname(download.tempName), fileName);
    }

    download.size = size;
    download.assembler.setTotalSize(size);

    if (size > this.mMinChunkSize) {
      const chunkSize = Math.ceil(Math.max(this.mMinChunkSize, size / this.mMaxChunks));
      let offset = this.mMinChunkSize + 1;
      while (offset < size) {
        download.chunks.push({
          received: 0,
          offset,
          size: chunkSize,
          state: 'init',
          url: download.urls[0],
        });
        offset += chunkSize;
      }
      log('debug', 'downloading file in chunks',
        { size: chunkSize, count: download.chunks.length, max: this.mMaxChunks, total: size });
      this.tickQueue();
    } else {
      log('debug', 'file is too small to be chunked',
        { name: download.finalName, size });
    }
  }

  private toStoredChunk = (job: IDownloadJob): IChunk => {
    return {
      url: job.url,
      size: job.size,
      offset: job.offset,
      received: job.received,
    };
  }

  private toJob = (download: IRunningDownload, chunk: IChunk): IDownloadJob => {
    const job: IDownloadJob = {
      url: chunk.url,
      offset: chunk.offset,
      state: 'init',
      size: chunk.size,
      received: chunk.received,
    };
    if (download.size === undefined) {
      // if the size isn't known yet, use the first job response to update it
      job.responseCB = (size: number, fileName: string) =>
        this.updateDownload(download, size, fileName);
    }
    return job;
  }

  /**
   * gets called whenever a chunk runs to the end or is interrupted
   */
  private finishChunk(download: IRunningDownload, job: IDownloadJob, interrupted: boolean) {
    job.state = interrupted ? 'paused' : 'finished';
    this.stopWorker(job.workerId);

    log('debug', 'stopping chunk worker',
      { interrupted, id: job.workerId, offset: job.offset, size: job.size });

    const activeChunks = download.chunks.find(
      (chunk: IDownloadJob) => ['paused', 'finished'].indexOf(chunk.state) === -1);
    if (activeChunks === undefined) {
      let finalPath = download.tempName;
      download.assembler.close()
        .then(() => {
          if (download.finalName !== undefined) {
            return download.finalName
            .then((resolvedPath: string) => {
              finalPath = resolvedPath;
              log('debug', 'renaming download', { from: download.tempName, to: resolvedPath });
              return fs.renameAsync(download.tempName, resolvedPath);
            });
          } else if ((download.headers !== undefined)
                     && (contentType.parse(download.headers['content-type']).type === 'text/html')
                     && (!download.tempName.toLowerCase().endsWith('.html'))) {
            finalPath = download.tempName + '.html';
            log('debug', 'renaming redirected download',
              { from: download.tempName, to: finalPath });
            return fs.renameAsync(download.tempName, finalPath);
          }
        })
        .then(() => {
          const unfinishedChunks = download.chunks
            .filter(chunk => chunk.state === 'paused')
            .map(this.toStoredChunk);
          log('debug', 'remaining chunks', { finalPath, unfinishedChunks });
          download.finishCB({ filePath: finalPath, headers: download.headers, unfinishedChunks });
        });
    }
    this.tickQueue();
  }

  private stopWorker(id: number) {
    this.mSpeedCalculator.stopCounter(id);
    delete this.mBusyWorkers[id];
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
   * @returns {Promise<string>}
   */
  private unusedName(destination: string, fileName: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let fd = null;
      let counter = 0;
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      let fullPath = path.join(destination, fileName);

      const loop = () => {
        fs.openAsync(fullPath, 'wx')
          .then((newFd) => {
            fd = newFd;
            fs.closeSync(newFd);
            resolve(fullPath);
          }).catch((err) => {
            ++counter;
            fullPath = path.join(destination, `${base}.${counter}${ext}`);
            if (err.code === 'EEXIST') {
              loop();
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
