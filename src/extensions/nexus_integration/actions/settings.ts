import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

/*
 * associate with nxm urls
 */
export const setAssociatedWithNXMURLs =
  safeCreateAction('SET_ASSOCIATED_WITH_NXM_URLS', assoc => assoc);
