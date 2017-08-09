import { createAction } from 'redux-act';

export const setImportStep = createAction<any, {}>('SET_NMM_IMPORT_STEP');

export const setMods = createAction('SET_MODS');

export const selectImportFolder = createAction('SELECT_IMPORT_FOLDER');
