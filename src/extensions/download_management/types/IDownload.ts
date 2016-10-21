export type DownloadState = 'init' | 'started' | 'paused' | 'finished' | 'failed';

/**
 * download information
 * 
 * @export
 * @interface IDownload
 */
export interface IDownload {
  /**
   * current state of the download
   * 
   * @memberOf IDownload
   */
  state: DownloadState;
  /**
   * list of urls we know serve this file. Should be sorted by preference.
   * If download from the first url isn't possible, the others may be used
   * 
   * @type {string}
   * @memberOf IDownload
   */
  urls: string[];
  /**
   * path of the file being downloaded to
   * 
   * @type {string}
   * @memberOf IDownload
   */
  localPath: string;
  /**
   * info about the mod being downloaded. This will
   * be associated with the mod entry after its installation
   * 
   * @type {{ [key: string]: any }}
   * @memberOf IDownload
   */
  modInfo: { [key: string]: any };
  /**
   * size in bytes of this chunk
   * 
   * @type {number}
   * @memberOf IDownloadChunk
   */
  size: number;
  /**
   * number of bytes received so far
   * 
   * @type {number}
   * @memberOf IDownloadChunk
   */
  received: number;
}
