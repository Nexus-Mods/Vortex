import safeCreateAction from '../../../actions/safeCreateAction';

/*
 * action to set the user API Key. Takes one parameter, the api key as a string
 */
export const setUserAPIKey: any = safeCreateAction('SET_USER_API_KEY');
