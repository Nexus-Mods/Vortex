import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const setMaxDownloads = safeCreateAction('SET_MAX_DOWNLOADS', max => max);
export const setDownloadPath = safeCreateAction('SET_DOWNLOAD_PATH', dlPath => dlPath);
export const setShowDLDropzone = safeCreateAction('SET_SHOW_DL_DROPZONE', show => show);
export const setShowDLGraph = safeCreateAction('SET_SHOW_DL_GRAPH', show => show);
export const setCopyOnIFF = safeCreateAction('SET_COPY_ON_IFF', enabled => enabled);
export const setMaxBandwidth = safeCreateAction('SET_MAX_BANDWIDTH', bandwidth => bandwidth);
export const setCollectionConcurrency = safeCreateAction('SET_COLLECTION_INSTALL_DOWNLOAD_CONCURRENCY', enabled => enabled);
