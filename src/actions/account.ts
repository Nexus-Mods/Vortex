import { createAction } from 'redux-act';

/*
 * action to set the logged-in user. Takes two parameters of the form { login: text, password: password}
 */
export const setLoggedInUser = createAction('set the logged-in user to these parameters',
  (username: string, cookie: string) => ({ username, cookie }));

/*
 * action to set the user API Key. Takes one parameters of the form { API Key: text}
 */
export const setUserAPIKey = createAction('set the logged-in user to these parameters',
    (APIKey: string) => ({ APIKey }));

/*
* action to load User Info. Takes one parameters from the reduxPersist%3Aaccount { API Key: text}
*/
export const loadUserInfo = createAction('load User Info',
    (APIKey: string) => ({ APIKey }));