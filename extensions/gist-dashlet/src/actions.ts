import { createAction } from 'redux-act';
import { IGistNode } from './types';

export const setGists = createAction('SET_GISTS',
    (gists: IGistNode[]) => gists);
