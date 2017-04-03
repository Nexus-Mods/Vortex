import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * sets the list of known/supported games
 */
export const setKnownGames = safeCreateAction('SET_KNOWN_GAMES');

/**
 * displays the dialog for adding custom games
 */
export const setAddGameDialogVisible = safeCreateAction('SET_ADDGAME_DIALOG_VISIBLE',
  (visible: boolean) => ({ visible }));
