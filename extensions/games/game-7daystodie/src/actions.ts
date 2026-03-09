import { LoadOrder } from './types';
import { createAction } from 'redux-act';

export const setPrefixOffset = createAction('7DTD_SET_PREFIX_OFFSET',
  (profile: string, offset: number) => ({ profile, offset }));

export const setUDF = createAction('7DTD_SET_UDF',
  (udf: string) => ({ udf }));

export const setPreviousLO = createAction('7DTD_SET_PREVIOUS_LO',
  (profile: string, previousLO: LoadOrder) => ({ profile, previousLO }));