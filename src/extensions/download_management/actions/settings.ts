import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const setMaxDownloads = safeCreateAction('SET_MAX_DOWNLOADS', (max: number) => max);
export const setDownloadPath = safeCreateAction('SET_DOWNLOAD_PATH', (dlPath: string) => dlPath);
export const setShowDLDropzone = safeCreateAction('SET_SHOW_DL_DROPZONE', (show: boolean) => show);
export const setShowDLGraph = safeCreateAction('SET_SHOW_DL_GRAPH', (show: boolean) => show);
export const setCopyOnIFF = safeCreateAction('SET_COPY_ON_IFF', (enabled: boolean) => enabled);
export const setMaxBandwidth = safeCreateAction('SET_MAX_BANDWIDTH', (bandwidth: number) => bandwidth);
export const setCollectionConcurrency = safeCreateAction('SET_COLLECTION_INSTALL_DOWNLOAD_CONCURRENCY', (enabled: boolean) => enabled);
