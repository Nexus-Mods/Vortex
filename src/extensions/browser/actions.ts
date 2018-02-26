import safeCreateAction from '../../actions/safeCreateAction';

export const showURL = safeCreateAction('SHOW_URL', url => url);

export const closeBrowser = safeCreateAction('CLOSE_BROWSER');
