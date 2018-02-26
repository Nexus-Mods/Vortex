import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const showCategoriesDialog = safeCreateAction('SHOW_CATEGORIES_DIALOG', show => show);
