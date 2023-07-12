import { DataInvalid } from '../../util/CustomErrors';

import { URL } from 'url';

const sUrlExpression = /\/mods\/(\d+)\/files\/(\d+)/i;
const sCollectionUrlExpression = /\/collections\/(\w+)\/revisions\/(\d+|latest)/i;


export enum NXMType { Mod, Collection, OAuth, Premium }

class NXMUrl {
  private mGameId: string;
  private mModId: number;
  private mFileId: number;
  private mCollectionId: number;
  private mRevisionId: number;
  private mCollectionSlug: string;
  private mRevisionNumber: number;
  private mOAuthCode: string;
  private mOAuthState: string;
  private mKey: string;
  private mExpires: number;
  private mUserId: number;
  private mView: boolean;
  private mExtraParams: { [key: string]: string } = {};
  private mPremium: boolean;
  

  constructor(input: string) {
    let parsed: URL;
    try {
      parsed = new URL(input);
    } catch (err) {
      throw new DataInvalid('invalid nxm url "' + input + '"');
    }

    if (parsed.protocol !== 'nxm:') {
      throw new DataInvalid('invalid nxm url "' + input + '"');
    }

    this.mGameId = parsed.hostname;
    const matches = parsed.pathname.match(sUrlExpression);
    const collMatches = parsed.pathname.match(sCollectionUrlExpression);
    if (matches !== null) {
      if (matches.length !== 3) {
        throw new DataInvalid('invalid nxm url "' + input + '"');
      }

      this.mModId = parseInt(matches[1], 10);
      this.mFileId = parseInt(matches[2], 10);
    } else if (collMatches !== null) {
      if (collMatches.length !== 3) {
        throw new DataInvalid('invalid nxm url "' + input + '"');
      }

      // TODO: legacy, drop after alpha phase
      this.mCollectionId = parseInt(collMatches[1], 10);
      if ((collMatches[1].length) < 6 && !isNaN(this.mCollectionId)) {
        this.mRevisionId = parseInt(collMatches[2], 10);
      } else {
        this.mCollectionId = undefined;
        this.mCollectionSlug = collMatches[1];
        if  (collMatches[2] === 'latest') {
          this.mRevisionNumber = -1;
        } else {
          this.mRevisionNumber = parseInt(collMatches[2], 10);
        }
      }
    } else if ((parsed.hostname === 'oauth') && (parsed.pathname === '/callback')) {
      this.mOAuthCode = parsed.searchParams.get('code');
      this.mOAuthState = parsed.searchParams.get('state');
    } else if (parsed.hostname === 'premium') {
      this.mPremium = true; 
    }
    else {
      throw new DataInvalid(`invalid nxm url "${input}"`);
    }
    this.mKey = parsed.searchParams.get('key') || undefined;
    const exp = parsed.searchParams.get('expires') || undefined;
    this.mExpires = exp !== undefined ? parseInt(exp, 10) : undefined;
    const userId = parsed.searchParams.get('user_id') || undefined;
    this.mUserId = userId !== undefined ? parseInt(userId, 10) : undefined;
    const view = parsed.searchParams.get('view') ?? '0';
    this.mView = (view !== undefined)
      ? ((view.toLowerCase() === 'true') || (parseInt(view, 10) > 0))
      : undefined;

    for (const entry of parsed.searchParams.entries()) {
      this.mExtraParams[entry[0]] = entry[1];
    }
  }

  public get type(): 'mod' | 'collection' | 'oauth' | 'premium' {
    if (this.mOAuthCode !== undefined) {
      return 'oauth'
    } else if (this.mPremium) {
      return 'premium'
    } 
    else if ((this.mCollectionId !== undefined) || (this.mCollectionSlug !== undefined)) {
      return 'collection';
    } else {
      return 'mod';
    }
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

  public get collectionId(): number {
    return this.mCollectionId;
  }

  public get revisionId(): number {
    return this.mRevisionId;
  }

  public get collectionSlug(): string {
    return this.mCollectionSlug;
  }

  public get revisionNumber(): number {
    return this.mRevisionNumber;
  }

  public get oauthCode(): string {
    return this.mOAuthCode;
  }

  public get oauthState(): string {
    return this.mOAuthState;
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

  public getParam(key: string): string {
    return this.mExtraParams[key];
  }
}

export default NXMUrl;
