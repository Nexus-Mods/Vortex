import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * sets the background color of the row
 */
export const setModColor: any = safeCreateAction('SET_MOD_COLOR',
  (gameId: string, modId: string, modColor: string) => ({ gameId, modId, modColor }));

/**
 * sets the icon of the mod
 */
export const setModIcon: any = safeCreateAction('SET_MOD_ICON',
  (gameId: string, modId: string, modIcon: string) => ({ gameId, modId, modIcon }));

/**
 * sets the notes of the mod
 */
export const setModNotes: any = safeCreateAction('SET_MOD_NOTES',
  (gameId: string, modId: string, modNotes: string) => ({ gameId, modId, modNotes }));
