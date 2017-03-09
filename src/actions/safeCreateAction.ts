import { createAction, types } from 'redux-act';

type ActionCreator<Sig> = Sig;

function safeCreateAction<P, M>(description: string): ActionCreator<(...args: any[]) => any>;
function safeCreateAction<P, M, Sig>(description: string, payloadReducer: Sig): ActionCreator<Sig>;
function safeCreateAction<P, M, Sig>(description: string,
                                     payloadReducer?: Sig): ActionCreator<Sig> {
  if (types.has(description)) {
    types.remove(description);
  }
  return createAction(description, payloadReducer as any) as any;
}

export default safeCreateAction;
