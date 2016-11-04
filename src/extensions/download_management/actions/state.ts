import { createAction } from 'redux-act';

type IDictionary = { [key: string]: any };

/**
 * initialize a download (it may not be started immediately)
 */
export const initDownload = createAction('INIT_DOWNLOAD',
  (id: string, urls: string[], modInfo: IDictionary) => {
    return { id, urls, modInfo }; });

/**
 * set download progress (in percent)
 */
export const downloadProgress = createAction('DOWNLOAD_PROGRESS',
  (id: string, received: number, total: number) => {
    return { id, received, total };
  });

/**
 * set/change the file path
 */
export const setDownloadFilePath = createAction('SET_DOWNLOAD_FILEPATH',
  (id: string, filePath: string) => { return { id, filePath }; });

/**
 * mark download as started
 */
export const startDownload = createAction('START_DOWNLOAD',
  (id: string) => { return { id }; });

/**
 * mark download as finished
 */
export const finishDownload = createAction('FINISH_DOWNLOAD',
  (id: string, state: 'finished' | 'failed', failCause?: any) => ({ id, state, failCause }));

/**
 * mark download paused
 */
export const pauseDownload = createAction('PAUSE_DOWNLOAD',
  (id: string, paused: boolean) => { return { id, paused }; });

/**
 * remove a download (and associated file if any)
 */
export const removeDownload = createAction('REMOVE_DOWNLOAD',
  (id: string) => { return { id }; });

/**
 * sets the current download speed in bytes/second
 */
export const setDownloadSpeed = createAction('SET_DOWNLOAD_SPEED');
