import { createSelector } from "reselect";

import type { IState } from "../../types/IState";

import { getSafe } from "../../util/storeHelper";
import { truthy } from "../../util/util";
import { nexusGames } from "./util";
import { hasConfidentialWithNexus, hasPersistentWithNexus } from "./guards";

const downloadFiles = (state: IState) => state.persistent.downloads.files;

export const apiKey = (state: IState) => {
  if (!hasConfidentialWithNexus(state.confidential)) {
    return undefined;
  }
  return state.confidential.account?.nexus?.APIKey;
};

export const userInfo = (state: IState) => {
  if (!hasPersistentWithNexus(state.persistent)) {
    return undefined;
  }
  return state.persistent.nexus.userInfo;
};

export const isPremium = (state: IState) => {
  if (!hasPersistentWithNexus(state.persistent)) {
    return false;
  }
  return state.persistent.nexus.userInfo?.isPremium ?? false;
};

export const isLoggedIn = (state: IState) => {
  if (!hasConfidentialWithNexus(state.confidential)) {
    return false;
  }
  const { nexus } = state.confidential.account;
  return truthy(nexus?.APIKey) || truthy(nexus?.OAuthCredentials);
};

export const nexusIdsFromDownloadId = createSelector(
  downloadFiles,
  (state: IState, downloadId: string) => downloadId,
  (files, downloadId) => {
    const dl = files[downloadId];
    if (
      dl?.modInfo?.nexus?.ids?.gameId == null &&
      dl?.modInfo?.meta?.gameId == null
    ) {
      return undefined;
    }
    const numericGameId = nexusGames().find(
      (g) =>
        g.domain_name ===
        (dl.modInfo?.nexus?.ids?.gameId || dl?.modInfo?.meta?.domainName),
    );
    return {
      gameDomainName:
        dl?.modInfo?.nexus?.ids?.gameId || dl?.modInfo?.meta?.domainName,
      fileId: dl?.modInfo?.nexus?.ids?.fileId?.toString(),
      modId: dl?.modInfo?.nexus?.ids?.modId?.toString(),
      numericGameId: numericGameId?.id || parseInt(dl?.modInfo?.meta?.gameId),
      collectionSlug: dl?.modInfo?.nexus?.ids?.collectionSlug,
      collectionId:
        dl?.modInfo?.nexus?.ids?.collectionId?.toString() ??
        dl?.modInfo?.nexus?.revisionInfo?.collection?.id?.toString(),
      revisionId: dl?.modInfo?.nexus?.ids?.revisionId?.toString(),
    };
  },
);
