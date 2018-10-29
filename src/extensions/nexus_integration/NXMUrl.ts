import { DataInvalid } from '../../util/CustomErrors';

import { URL } from 'url';

const sUrlExpression = /\/mods\/(\d+)\/files\/(\d+)/i;

class NXMUrl {
  private mGameId: string;
  private mModId: number;
  private mFileId: number;
  private mKey: string;
  private mExpires: number;

  constructor(input: string) {
    let parsed: URL;
    try {
      parsed = new URL(input);
    } catch (err) {
      throw new DataInvalid('invalid nxm url "' + input + '"');
    }
    this.mGameId = parsed.hostname;
    const matches = parsed.pathname.match(sUrlExpression);
    if ((parsed.protocol !== 'nxm:') || (matches === null) || (matches.length !== 3)) {
      throw new DataInvalid('invalid nxm url "' + input + '"');
    }

    this.mModId = parseInt(matches[1], 10);
    this.mFileId = parseInt(matches[2], 10);
    this.mKey = parsed.searchParams.get('key');
    this.mExpires = parseInt(parsed.searchParams.get('expires'), 10);
  }

  public get gameId(): string {
    return this.mGameId;
  }

  public get modId(): number {
    return this.mModId;
  }

  public get fileId(): number {
    return this.mFileId;
  }

  /**
   * a key identifying the user that requested the nxm link
   */
  public get key(): string {
    return this.mKey;
  }

  /**
   * returns a timestamp of when the link becomes invalid
   */
  public get expires(): number {
    return this.mExpires;
  }
}

export default NXMUrl;
