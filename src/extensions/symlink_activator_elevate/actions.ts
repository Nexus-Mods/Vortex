import safeCreateAction from '../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const enableUserSymlinks = safeCreateAction('ENABLE_USER_SYMLINKS',
  (enabled: boolean) => enabled);
