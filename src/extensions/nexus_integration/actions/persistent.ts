import safeCreateAction from '../../../actions/safeCreateAction';

function id(input) {
  return input;
}

/**
 * action to set the user info nexus associates with an api key
 */
export const setUserInfo = safeCreateAction('SET_USER_INFO', id);


/**
 * remember current version available on nexus
 */
export const setNewestVersion = safeCreateAction('SET_NEWEST_VERSION', id);
