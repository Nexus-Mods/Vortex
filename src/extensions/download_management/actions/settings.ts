import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const setMaxDownloads = safeCreateAction('SET_MAX_DOWNLOADS', max => max);
