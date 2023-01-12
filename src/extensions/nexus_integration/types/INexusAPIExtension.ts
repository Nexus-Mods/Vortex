import { EndorsedStatus, ICollection, ICollectionManifest, IDownloadURL, IFeedbackResponse, IFileInfo, IIssue, IRevision } from '@nexusmods/nexus-api';
import { IMod } from '../../mod_management/types/IMod';

export interface INexusAPIExtension {
  nexusCheckModsVersion?: (gameId: string, mods: { [modId: string]: IMod }, forceFull: boolean | 'silent') => void;
  nexusDownload?:
    (gameId: string, modId: number, fileId: number, fileName?: string, allowInstall?: boolean)
      => PromiseLike<string>;
  nexusGetCollection?: (slug: string) => PromiseLike<ICollection>;
  nexusGetCollections?: (gameId: string) => PromiseLike<ICollection[]>;
  nexusGetMyCollections?:
    (gameId: string, count?: number, offset?: number) => PromiseLike<IRevision[]>;
  nexusResolveCollectionUrl?: (apiLink: string) => PromiseLike<IDownloadURL[]>;
  nexusGetCollectionRevision?:
    (collectionSlug: string, revisionNumber: number) => PromiseLike<IRevision>;
  nexusRateCollectionRevision?: (revisionId: number, rating: number) => PromiseLike<any>;
  nexusGetLatestMods?: (gameId: string) => PromiseLike<any>;
  nexusGetTrendingMods?: (gameId: string) => PromiseLike<any>;
  nexusEndorseDirect?:
    (gameId: string, nexusId: number, version: string, endorsedStatus: EndorsedStatus)
    => PromiseLike<EndorsedStatus>;
  nexusEndorseMod?: (gameId: string, modId: string, endorsedStatus: EndorsedStatus) => void;
  nexusSubmitFeedback?:
    (title: string, message: string, hash: string, feedbackFiles: string[],
     anonymous: boolean, callback: (err: Error, response?: IFeedbackResponse) => void) => void;
  nexusSubmitCollection?:
    (collectionInfo: ICollectionManifest, assetFilePath: string,
     collectionId: number, callback: (err: Error, response?: any) => void) => void;
  nexusModUpdate?: (gameId: string, modId: number, fileId: number, source: string) => void;
  nexusOpenCollectionPage?:
    (gameId: string, collectionSlug: string, revisionNumber: number, source: string) => void;
  nexusOpenModPage?: (gameId: string, modId: string, source: string) => void;
  nexusRequestNexusLogin?: (callback: any) => void;
  nexusRequestOwnIssues?: (cb: (err: Error, issues?: IIssue[]) => void) => void;
  nexusRetrieveCategoryList?: (isUpdate: boolean) => void;
  nexusGetModFiles?: (gameId: string, modId: number) => PromiseLike<IFileInfo[]>;
  nexusDownloadUpdate?: (source: string, gameId: string, modId: string,
    fileId: string, versionPattern: string,
    campaign: string, referenceTag?: string) => PromiseLike<{ error: Error, dlId?: string }>;
}
