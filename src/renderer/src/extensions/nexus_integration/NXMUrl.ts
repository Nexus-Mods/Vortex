import { URL } from "url";

import { DataInvalid } from "../../util/CustomErrors";
import type { IDownload } from "../download_management/types/IDownload";
import type { IGameStoredExt } from "../gamemode_management/types/IGameStored";
import { toNXMId } from "./util/convertGameId";

const sUrlExpression = /\/mods\/(\d+)\/files\/(\d+)/i;
const sCollectionUrlExpression = /\/collections\/(\w+)\/revisions\/(\d+|latest)/i;

export enum NXMType {
  Mod,
  Collection,
  OAuth,
  Premium,
}

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

  constructor(input: string | URL) {
    let parsed: URL;
    try {
      parsed = typeof input === "string" ? new URL(input) : input;
    } catch (err) {
      throw new DataInvalid('invalid nxm url "' + input + '"');
    }

    if (parsed.protocol !== "nxm:") {
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
      if (collMatches[1].length < 6 && !isNaN(this.mCollectionId)) {
        this.mRevisionId = parseInt(collMatches[2], 10);
      } else {
        this.mCollectionId = undefined;
        this.mCollectionSlug = collMatches[1];
        if (collMatches[2] === "latest") {
          this.mRevisionNumber = -1;
        } else {
          this.mRevisionNumber = parseInt(collMatches[2], 10);
        }
      }
    } else if (parsed.hostname === "oauth" && parsed.pathname === "/callback") {
      this.mOAuthCode = parsed.searchParams.get("code");
      this.mOAuthState = parsed.searchParams.get("state");
    } else if (parsed.hostname === "premium") {
      this.mPremium = true;
    } else {
      throw new DataInvalid(`invalid nxm url "${input}"`);
    }
    this.mKey = parsed.searchParams.get("key") || undefined;
    const exp = parsed.searchParams.get("expires") || undefined;
    this.mExpires = exp !== undefined ? parseInt(exp, 10) : undefined;
    const userId = parsed.searchParams.get("user_id") || undefined;
    this.mUserId = userId !== undefined ? parseInt(userId, 10) : undefined;
    const view = parsed.searchParams.get("view") ?? "0";
    this.mView =
      view !== undefined ? view.toLowerCase() === "true" || parseInt(view, 10) > 0 : undefined;

    for (const entry of parsed.searchParams.entries()) {
      this.mExtraParams[entry[0]] = entry[1];
    }
  }

  public get type(): "mod" | "collection" | "oauth" | "premium" {
    if (this.mOAuthCode !== undefined) {
      return "oauth";
    } else if (this.mPremium) {
      return "premium";
    } else if (this.mCollectionId !== undefined || this.mCollectionSlug !== undefined) {
      return "collection";
    } else {
      return "mod";
    }
  }

  public get identifiers(): {
    type: NXMType;
    gameId: string;
    modId?: number;
    fileId?: number;
    collectionId?: number;
    revisionId?: number;
    collectionSlug?: string;
    revisionNumber?: number;
  } {
    return this.type === "mod"
      ? {
          type: NXMType.Mod,
          gameId: this.mGameId,
          modId: this.mModId,
          fileId: this.mFileId,
        }
      : this.type === "collection"
        ? {
            type: NXMType.Collection,
            gameId: this.mGameId,
            collectionId: this.mCollectionId,
            revisionId: this.mRevisionId,
            collectionSlug: this.mCollectionSlug,
            revisionNumber: this.mRevisionNumber,
          }
        : null;
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

/**
 * assemble an nxm mod-file url from an already nxm-ready domain. Prefer nxmModUrl when you hold a
 * game object; use this only when the domain is already resolved (e.g. from a persisted download).
 */
export function buildNXMModUrl(
  domain: string,
  modId: number | string,
  fileId: number | string,
): string {
  return `nxm://${domain}/mods/${modId}/files/${fileId}`;
}

/**
 * assemble an nxm collection url from an already nxm-ready domain.
 */
export function buildNXMCollectionUrl(
  domain: string,
  slug: string,
  revisionNumber: number | string,
): string {
  return `nxm://${domain}/collections/${slug}/revisions/${revisionNumber}`;
}

/**
 * build the canonical nxm mod-file url for a game, resolving the nxm link id via toNXMId.
 */
export function nxmModUrl(
  game: IGameStoredExt,
  gameId: string,
  modId: number | string,
  fileId: number | string,
): string {
  return buildNXMModUrl(toNXMId(game, gameId), modId, fileId);
}

/**
 * Rebuild the source nxm url for a download from its persisted nexus ids, for records whose stored
 * urls are empty. Returns undefined when the download carries no usable nexus identity (or a
 * collection download lacks a revision number). The rebuilt url carries no key/expires query, so
 * non-premium accounts get the resolver's normal free-user handling.
 */
export function nxmUrlFromDownload(download: IDownload): string | undefined {
  const ids = download?.modInfo?.nexus?.ids;
  const meta = download?.modInfo?.meta;
  // A record with neither a nexus nor a meta game id is not a resumable nexus download.
  if (ids?.gameId == null && meta?.gameId == null) {
    return undefined;
  }
  const domain = ids?.gameId || meta?.domainName;
  if (!domain) {
    return undefined;
  }
  if (ids?.collectionSlug != null) {
    if (ids.revisionNumber == null) {
      return undefined;
    }
    return buildNXMCollectionUrl(domain, ids.collectionSlug, ids.revisionNumber);
  }
  if (ids?.modId != null && ids?.fileId != null) {
    return buildNXMModUrl(domain, ids.modId, ids.fileId);
  }
  return undefined;
}

export default NXMUrl;
