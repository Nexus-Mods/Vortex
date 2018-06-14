import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const setMaxDownloads = safeCreateAction('SET_MAX_DOWNLOADS', max => max);
export const setShowDLDropzone = safeCreateAction('SET_SHOW_DL_DROPZONE', show => show);
export const setShowDLGraph = safeCreateAction('SET_SHOW_DL_GRAPH', show => show);
