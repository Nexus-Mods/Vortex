import { createAction } from 'redux-act';

import { ICategory } from '../types/ICategory';
import { IStateCategory } from '../types/IStateCategory';

export const addCategory: any = createAction('ADD_CATEGORY',
  (category: ICategory) => category);

  export const setStateCategory: any = createAction('SET_STATE_CATEGORY',
  (category: IStateCategory) => category);
