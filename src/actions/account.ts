import { createAction } from 'redux-act';

/*
 * action to set the logged-in user. Takes two parameters of the form { login: text, password: password}
 */
export const setLoggedInUser = createAction('set the logged-in user to these parameters',
  (username: string, cookie: string) => ({ username, cookie }));
