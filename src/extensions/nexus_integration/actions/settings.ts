import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const setAssociatedWithNXMURLs = safeCreateAction('SET_ASSOCIATED_WITH_NXM_URLS', (associated: boolean) => associated);
