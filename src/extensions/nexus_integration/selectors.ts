import { IState } from '../../types/IState';
import { getSafe } from '../../util/storeHelper';

import { createSelector } from 'reselect';
import { truthy } from '../../util/util';

import { nexusGames } from '../nexus_integration/util';

const downloadFiles = (state: IState) => state.persistent.downloads.files;

export const apiKey = (state: IState) =>
  getSafe(state, ['confidential', 'account', 'nexus', 'APIKey'], undefined);

export const isLoggedIn = (state: IState) => {
  const APIKEY = state.confidential.account['nexus']?.APIKey;
  const OAuthCredentials = state.confidential.account['nexus']?.OAuthCredentials;
  return truthy(APIKEY) || truthy(OAuthCredentials);
};

export const nexusIdsFromDownloadId = createSelector(
  downloadFiles, (state: IState, downloadId: string) => downloadId,
  (files, downloadId) => {
    const dl = files[downloadId];
    if (dl?.modInfo?.nexus?.ids?.gameId == null) {
      return undefined;
    }
    const numericId = nexusGames().find(g => g.domain_name === dl.modInfo.nexus.ids.gameId);
    return {
      domainName: dl.modInfo.nexus.ids.gameId,
      fileId: dl.modInfo.nexus.ids.fileId,
      modId: dl.modInfo.nexus.ids.modId,
      numericId: numericId?.id?.toString(),
   }
});