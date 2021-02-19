import { IChunk } from './IChunk';

export type DownloadState = 'init' | 'started' | 'paused' | 'finalizing' | 'finished' | 'failed' | 'redirect';

export interface IDownloadFailCause {
  htmlFile?: string;
  message?: string;
}

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
   * if the download failed, this will contain a more detailed description
   * of the error
   *
   * @type {IDownloadFailCause}
   * @memberOf IDownload
   */
  failCause?: IDownloadFailCause;

  /**
   * list of urls we know serve this file. Should be sorted by preference.
   * If download from the first url isn't possible, the others may be used
   *
   * @type {string}
   * @memberOf IDownload
   */
  urls: string[];

  /**
   * path of the file being downloaded to. This is relative to the base download
   * directory for the game and since we use a flat directory structure, this is
   * in practice just the file name
   *
   * @type {string}
   * @memberOf IDownload
   */
  localPath?: string;

  /**
   * id of the game(s) to which this archive is compatible.
   *
   * @type {string}
   * @memberOf IDownload
   */
  game: string[];

  /**
   * info about the mod being downloaded. This will
   * be associated with the mod entry after its installation
   *
   * @type {{ [key: string]: any }}
   * @memberOf IDownload
   */
  modInfo: { [key: string]: any };

  /**
   * id of the (last) mod installed from this archive. Will be undefined
   * while the archive is not installed. This will not be unset if the
   * mod is uninstalled, so to determine if the archive is actually installed
   * one has to look at the dictionary of installed mods
   */
  installed?: { gameId: string, modId: string };

  /**
   * hash of the file data
   *
   * @type {string}
   * @memberOf IDownload
   */
  fileMD5?: string;

  /**
   * MS timestamp the download was started
   */
  startTime: number;

  /**
   * MS timestamp the file finished downloading
   */
  fileTime: number;

  /**
   * size in bytes
   *
   * @type {number}
   * @memberOf IDownload
   */
  size: number;

  /**
   * number of bytes received so far
   *
   * @type {number}
   * @memberOf IDownload
   */
  received: number;

  /**
   * number of bytes hashed during finalizing
   */
  verified: number;

  /**
   * for paused downloads, this contains the list segments that are still missing
   */
  chunks?: IChunk[];

  /**
   * whether the download server supports resuming downloads
   */
  pausable?: boolean;
}
