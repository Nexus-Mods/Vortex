import safeCreateAction from '../../../actions/safeCreateAction';
import { IChunk } from '../types/IChunk';

import * as reduxAct from 'redux-act';

export interface IDictionary {
  [key: string]: any;
}

/**
 * initialize a download (it may not be started immediately)
 */
export const initDownload = safeCreateAction('INIT_DOWNLOAD',
  (id: string, urls: string[], modInfo: IDictionary, game: string) => ({
    id, urls, modInfo, game,
  }));

/**
 * set download progress (in percent)
 */
export const downloadProgress = safeCreateAction('DOWNLOAD_PROGRESS',
  (id: string, received: number, total: number, chunks: IChunk[], urls: string[]) =>
    ({ id, received, total, chunks, urls }));

/**
 * set/change the file path
 */
export const setDownloadFilePath = safeCreateAction('SET_DOWNLOAD_FILEPATH',
  (id: string, filePath: string) => ({ id, filePath }));

/**
 * mark download as started
 */
export const startDownload = safeCreateAction('START_DOWNLOAD',
  (id: string) => ({ id }));

/**
 * mark download as finalizing, meaning the file has been downloaded fully,
 * during this phase checksums are calculated for example
 */
export const finalizingDownload = safeCreateAction('FINALIZING_DOWNLOAD',
  (id: string) => ({ id }));

/**
 * mark download as finished
 */
export const finishDownload = safeCreateAction('FINISH_DOWNLOAD',
  (id: string, state: 'finished' | 'failed' | 'redirect', failCause: any) =>
    ({ id, state, failCause }));

export const setDownloadHash = safeCreateAction('SET_DOWNLOAD_HASH',
  (id: string, fileMD5: string) => ({ id, fileMD5 }));

export const setDownloadHashByFile = safeCreateAction('SET_DOWNLOAD_HASH_BY_FILE',
  (fileName: string, fileMD5: string, fileSize: number) => ({ fileName, fileMD5, fileSize }));

/**
 * mark download paused
 */
export const pauseDownload = safeCreateAction('PAUSE_DOWNLOAD',
  (id: string, paused: boolean, chunks: IChunk[]) => ({ id, paused, chunks }));

export const setDownloadInterrupted = safeCreateAction('SET_DOWNLOAD_INTERRUPTED',
  (id: string, realReceived: number) => ({ id, realReceived }));

/**
 * remove a download (and associated file if any)
 */
export const removeDownload = safeCreateAction('REMOVE_DOWNLOAD',
  (id: string) => ({ id }));

/**
 * sets the current download speed in bytes/second
 */
export const setDownloadSpeed = safeCreateAction(
  'SET_DOWNLOAD_SPEED', speed => speed, () => ({ forward: false }));

export const setDownloadSpeeds = safeCreateAction(
  'SET_DOWNLOAD_SPEEDS', speeds => speeds);

/**
 * add a file that has been found on disk but where we weren't involved
 * in the download.
 */
export const addLocalDownload = safeCreateAction('ADD_LOCAL_DOWNLOAD',
  (id: string, game: string, localPath: string, fileSize: number) =>
    ({ id, game, localPath, fileSize }));

export const mergeDownloadModInfo = safeCreateAction('MERGE_DOWNLOAD_MODINFO',
  (id: string, value: any) => ({ id, value }));

export const setDownloadModInfo = safeCreateAction('SET_DOWNLOAD_MODINFO',
  (id: string, key: string, value: any) => ({ id, key, value }));

export const setDownloadInstalled = safeCreateAction('SET_DOWNLOAD_INSTALLED',
  (id: string, gameId: string, modId: string) => ({ id, gameId, modId }));

export const setDownloadTime = safeCreateAction('SET_DOWNLOAD_TIME',
  (id: string, time: number) => ({ id, time }));

export const setCompatibleGames = safeCreateAction('SET_COMPATIBLE_GAMES',
  (id: string, games: string[]) => ({ id, games }));
