import { countIf } from '../../util/util';

import FileAssembler from './FileAssembler';
import SpeedCalculator from './SpeedCalculator';

import * as fs from 'fs-extra-promise';
import * as http from 'http';
import * as path from 'path';
import request = require('request');
import * as url from 'url';

import { log } from '../../util/log';

interface IProgressCallback {
  (received: number, total: number, filePath?: string): void;
}

interface IDownloadJob {
  url: string;
  offset: number;
  state: 'init' | 'running' | 'finished';
  workerId?: number;
  size?: number;
  dataCB?: (offset: number, data) => void;
  completionCB?: () => void;
  errorCB?: (err) => void;
  responseCB?: (size: number, fileName: string) => void;
}

interface IDownload {
  id: string;
  fd?: number;
  urls: string[];
  origName: string;
  tempName: string;
  finalName?: Promise<string>;
  lastProgressSent: number;
  received: number;
  size?: number;
  assembler?: FileAssembler;
  chunks: IDownloadJob[];
  promises: Promise<any>[];
  progressCB?: IProgressCallback;
  finishCB: (fileName: string) => void;
  failedCB: (err) => void;
}

interface IFinishCallback {
  (): void;
}

/**
 * a download worker. A worker is started to download one chunk of a file,
 * they are currently not reused.
 * 
 * @class DownloadWorker
 */
class DownloadWorker {

  private mJob: IDownloadJob;
  private mRequest: request.Request;
  private mProgressCB: (bytes: number) => void;
  private mFinishCB: IFinishCallback;

  constructor(job: IDownloadJob, progressCB: (bytes: number) => void, finishCB: IFinishCallback) {
    this.mProgressCB = progressCB;
    this.mFinishCB = finishCB;
    this.mJob = job;
    this.assignJob(job);
  }

  public assignJob(job: IDownloadJob) {
    log('info', 'request at offset', { offset: job.offset, size: job.size,
      end: job.offset + job.size });
    this.mRequest = request({
      method: 'GET',
      uri: job.url,
      headers: {
        Range: `bytes=${job.offset}-${job.offset + job.size}`,
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
    this.mFinishCB();
  }

  private handleError(err) {
    if (this.mJob.errorCB !== undefined) {
      this.mJob.errorCB(err);
    }
    this.mRequest.abort();
    this.mFinishCB();
  }

  private handleComplete(response: http.IncomingMessage, body) {
    if (this.mJob.completionCB !== undefined) {
      this.mJob.completionCB();
    }
    this.mFinishCB();
  }

  private handleResponse(response: http.IncomingMessage) {
    if (this.mJob.responseCB !== undefined) {
      let size = response.headers['content-length'];
      if ('content-range' in response.headers) {
        const rangeExp: RegExp = /bytes (\d)*-(\d*)\/(\d*)/i;
        let sizeMatch: string[] = response.headers['content-range'].match(rangeExp);
        if (sizeMatch.length > 1) {
          size = parseInt(sizeMatch[3], 10);
        }
      }

      let fileName = undefined;
      if ('content-disposition' in response.headers) {
        const fileNameExp: RegExp = /filename=(.*)/i;
        let nameMatch: string[] = response.headers['content-disposition'].match(fileNameExp);
        if (nameMatch.length > 1) {
          fileName = nameMatch[1];
        }
      }
      this.mJob.responseCB(size, fileName);
    }
  }

  private handleData(data) {
    this.mJob.dataCB(this.mJob.offset, data);
    this.mJob.offset += data.length;
    this.mProgressCB(data.length);
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
  private mQueue: IDownload[] = [];
  private mNextId: number = 0;
  private mSpeedCalculator: SpeedCalculator;
  private mCurrentTick: number;

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
              speedCB: (speed: number) => void) {
    // TODO is it worth having this configurable?
    this.mMinChunkSize = 1024 * 1024;
    this.mDownloadPath = downloadPath;
    this.mMaxWorkers = maxWorkers;
    this.mMaxChunks = maxChunks;
    this.mSpeedCalculator = new SpeedCalculator(5, speedCB);

    setInterval(() => {
      this.mCurrentTick = new Date().getTime() / 1000;
    }, 1000);
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
  public enqueue(id: string, urls: string[], progressCB: IProgressCallback,
                 destinationPath?: string): Promise<string> {
    const nameTemplate: string = path.basename(url.parse(urls[0]).pathname);
    return this.unusedName(destinationPath || this.mDownloadPath, nameTemplate)
    .then((filePath: string) => {
      return new Promise<string>((resolve, reject) => {
        let download: IDownload = {
          id,
          origName: nameTemplate,
          tempName: filePath,
          urls,
          lastProgressSent: 0,
          received: 0,
          chunks: [],
          progressCB,
          finishCB: resolve,
          failedCB: reject,
          promises: [],
        };
        download.chunks.push(this.initChunk(download));
        this.mQueue.push(download);
        this.tickQueue();
      });
    });
  }

  /**
   * cancel a download. This stops the download but doesn't remove the file
   * 
   * @param {string} id
   * 
   * @memberOf DownloadManager
   */
  public cancel(id: string) {
    const download: IDownload = this.mQueue.find(
      (value: IDownload) => value.id === id);
    if (download === undefined) {
      log('warn', 'failed to cancel download, not found', { id });
      return;
    }
    // stop running workers
    download.chunks.forEach((value: IDownloadJob) => {
      if (value.state === 'running') {
        this.mBusyWorkers[value.workerId].cancel();
      }
    });
    // remove from queue
    this.mQueue = this.mQueue.filter(
      (value: IDownload) => value.id !== id);
  }

  private initChunk(download: IDownload): IDownloadJob {
    return {
      url: download.urls[0],
      offset: 0,
      state: 'init',
      size: this.mMinChunkSize,
      errorCB: (err) => { this.cancelDownload(download, err); },
      responseCB: (size: number, fileName: string) =>
        this.updateDownload(download, size, fileName),
    };
  }

  private cancelDownload(download: IDownload, err) {
    for (let chunk of download.chunks) {
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
        this.startWorker(this.mQueue[idx]);
        --unstartedChunks;
        --freeSpots;
      }
      ++idx;
    }
  }

  private startWorker(download: IDownload) {
    const workerId: number = this.mNextId++;
    log('info', 'start worker', { workerId });
    this.mSpeedCalculator.initCounter(workerId);
    let job: IDownloadJob = download.chunks.find((ele) => ele.state === 'init');
    job.state = 'running';
    job.workerId = workerId;

    if (download.assembler === undefined) {
      download.assembler = new FileAssembler(download.tempName);
    }
    job.dataCB = (offset: number, data: Buffer) => {
      download.assembler.addChunk(offset, data);
      download.received += data.byteLength;
      if (download.lastProgressSent !== this.mCurrentTick) {
        download.progressCB(download.received, download.size, download.tempName);
        download.lastProgressSent = this.mCurrentTick;
      }
    };

    this.mBusyWorkers[workerId] = new DownloadWorker(job,
      (bytes) => this.mSpeedCalculator.addMeasure(workerId, bytes),
      () => this.finishChunk(download, job));
  }

  private updateDownload(download: IDownload, size: number, fileName: string) {
    if (fileName !== download.origName) {
      download.finalName = this.unusedName(path.dirname(download.tempName), fileName);
    }

    download.size = size;
    download.assembler.setTotalSize(size);

    if (size > this.mMinChunkSize) {
      let chunkSize = Math.ceil(Math.max(this.mMinChunkSize, size / this.mMaxChunks));
      let offset = this.mMinChunkSize + 1;
      while (offset < size) {
        download.chunks.push({
          offset,
          size: chunkSize,
          state: 'init',
          url: download.urls[0],
        });
        offset += chunkSize;
      }
      this.tickQueue();
    }
  }

  private finishChunk(download: IDownload, job: IDownloadJob) {
    log('debug', 'finished chunk', { workerId: job.workerId });
    job.state = 'finished';
    this.stopWorker(job.workerId);
    let unfinished = download.chunks.find(
      (chunk: IDownloadJob) => chunk.state !== 'finished');
    if (unfinished === undefined) {
      let finalPath = download.tempName;
      download.assembler.close()
        .then(() => {
          if (download.finalName !== undefined) {
            return download.finalName
            .then((resolvedPath: string) => {
              finalPath = resolvedPath;
              return fs.renameAsync(download.tempName, resolvedPath);
            });
          }
        })
        .then(() => {
          download.finishCB(finalPath);
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
      let ext = path.extname(fileName);
      let base = path.basename(fileName, ext);
      let fullPath = path.join(destination, fileName);

      let loop = () => {
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
