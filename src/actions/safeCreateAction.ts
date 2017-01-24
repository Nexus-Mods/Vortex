import { createAction, types } from 'redux-act';

function safeCreateAction<P, M>(description: string, payloadReducer?: (...args: any[]) => P): any {
  if (types.has(description)) {
    types.remove(description);
  }
  return createAction(description, payloadReducer);
}

export default safeCreateAction;
