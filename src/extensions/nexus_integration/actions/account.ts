import { createAction } from 'redux-act';

/*
 * action to set the user API Key. Takes one parameter, the api key as a string
 */
export const setUserAPIKey = createAction('SET_USER_API_KEY');
