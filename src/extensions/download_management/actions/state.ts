import safeCreateAction from '../../../actions/safeCreateAction';

type IDictionary = { [key: string]: any };

/**
 * initialize a download (it may not be started immediately)
 */
export const initDownload: any = safeCreateAction('INIT_DOWNLOAD',
  (id: string, urls: string[], modInfo: IDictionary, game: string) => ({
    id, urls, modInfo, game,
  }));

/**
 * set download progress (in percent)
 */
export const downloadProgress: any = safeCreateAction('DOWNLOAD_PROGRESS',
  (id: string, received: number, total: number) => ({ id, received, total }));

/**
 * set/change the file path
 */
export const setDownloadFilePath: any = safeCreateAction('SET_DOWNLOAD_FILEPATH',
  (id: string, filePath: string) => ({ id, filePath }));

/**
 * mark download as started
 */
export const startDownload: any = safeCreateAction('START_DOWNLOAD',
  (id: string) => ({ id }));

/**
 * mark download as finished
 */
export const finishDownload: any = safeCreateAction('FINISH_DOWNLOAD',
  (id: string, state: 'finished' | 'failed', failCause?: any) => ({ id, state, failCause }));

export const setDownloadHash: any = safeCreateAction('SET_DOWNLOAD_HASH',
  (id: string, fileMD5: string) => ({ id, fileMD5 }));

export const setDownloadHashByFile: any = safeCreateAction('SET_DOWNLOAD_HASH_BY_FILE',
  (fileName: string, fileMD5: string, fileSize: number) => ({ fileName, fileMD5, fileSize }));

/**
 * mark download paused
 */
export const pauseDownload: any = safeCreateAction('PAUSE_DOWNLOAD',
  (id: string, paused: boolean) => ({ id, paused }));

/**
 * remove a download (and associated file if any)
 */
export const removeDownload: any = safeCreateAction('REMOVE_DOWNLOAD',
  (id: string) => ({ id }));

/**
 * sets the current download speed in bytes/second
 */
export const setDownloadSpeed: any = safeCreateAction('SET_DOWNLOAD_SPEED');

/**
 * add a file that has been found on disk but where we weren't involved
 * in the download.
 */
export const addLocalDownload: any = safeCreateAction('ADD_LOCAL_DOWNLOAD',
  (id: string, game: string, localPath: string, fileSize: number) =>
    ({ id, game, localPath, fileSize }));
