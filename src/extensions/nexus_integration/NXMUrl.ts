import { DataInvalid } from '../../util/CustomErrors';

import { URL } from 'url';

const sUrlExpression = /\/mods\/(\d+)\/files\/(\d+)/i;

class NXMUrl {
  private mGameId: string;
  private mModId: number;
  private mFileId: number;
  private mKey: string;
  private mExpires: number;
  private mUserId: number;
  private mView: boolean;

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
    this.mKey = parsed.searchParams.get('key') || undefined;
    const exp = parsed.searchParams.get('expires') || undefined;
    this.mExpires = exp !== undefined ? parseInt(exp, 10) : undefined;
    const userId = parsed.searchParams.get('user_id') || undefined;
    this.mUserId = userId !== undefined ? parseInt(userId, 10) : undefined;
    const view = parsed.searchParams.get('view') ?? '0';
    this.mView = (view !== undefined)
      ? ((view.toLowerCase() === 'true') || (parseInt(view, 10) > 0))
      : undefined;
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

  /**
   * returns the user id for whom the download was created
   */
  public get userId(): number {
    return this.mUserId;
  }

  public get view(): boolean {
    return this.mView;
  }
}

export default NXMUrl;
