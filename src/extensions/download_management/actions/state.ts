import { createAction } from 'redux-act';

type IDictionary = { [key: string]: any };

/**
 * initialize a download (it may not be started immediately)
 */
export const initDownload:any = createAction('INIT_DOWNLOAD',
  (id: string, urls: string[], modInfo: IDictionary) => ({ id, urls, modInfo }));

/**
 * set download progress (in percent)
 */
export const downloadProgress:any = createAction('DOWNLOAD_PROGRESS',
  (id: string, received: number, total: number) => ({ id, received, total }));

/**
 * set/change the file path
 */
export const setDownloadFilePath:any = createAction('SET_DOWNLOAD_FILEPATH',
  (id: string, filePath: string) => ({ id, filePath }));

/**
 * mark download as started
 */
export const startDownload:any = createAction('START_DOWNLOAD',
  (id: string) => ({ id }));

/**
 * mark download as finished
 */
export const finishDownload:any = createAction('FINISH_DOWNLOAD',
  (id: string, state: 'finished' | 'failed', failCause?: any) => ({ id, state, failCause }));

export const setDownloadHash:any = createAction('SET_DOWNLOAD_HASH',
  (id: string, fileMD5: string) => ({ id, fileMD5 }));

/**
 * mark download paused
 */
export const pauseDownload:any = createAction('PAUSE_DOWNLOAD',
  (id: string, paused: boolean) => ({ id, paused }));

/**
 * remove a download (and associated file if any)
 */
export const removeDownload:any = createAction('REMOVE_DOWNLOAD',
  (id: string) => ({ id }));

/**
 * sets the current download speed in bytes/second
 */
export const setDownloadSpeed:any = createAction('SET_DOWNLOAD_SPEED');
