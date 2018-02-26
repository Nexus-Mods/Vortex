import { createAction, types } from 'redux-act';
import * as ra from 'redux-act';

// tslint:disable:max-line-length
export function safeCreateAction(description: string): ra.EmptyActionCreator;
export function safeCreateAction<P, M = {}>(description: string): ra.SimpleActionCreator<P, M>;
export function safeCreateAction<Arg1, P, M = {}>(description: string, payloadReducer: ra.PayloadReducer1<Arg1, P>): ra.ComplexActionCreator1<Arg1, P, M>;
export function safeCreateAction<Arg1, Arg2, P, M = {}>(description: string, payloadReducer: ra.PayloadReducer2<Arg1, Arg2, P>): ra.ComplexActionCreator2<Arg1, Arg2, P, M>;
export function safeCreateAction<Arg1, Arg2, Arg3, P, M = {}>(description: string, payloadReducer: ra.PayloadReducer3<Arg1, Arg2, Arg3, P>): ra.ComplexActionCreator3<Arg1, Arg2, Arg3, P, M>;
export function safeCreateAction<Arg1, Arg2, Arg3, Arg4, P, M = {}>(description: string, payloadReducer: ra.PayloadReducer4<Arg1, Arg2, Arg3, Arg4, P>): ra.ComplexActionCreator4<Arg1, Arg2, Arg3, Arg4, P, M>;
export function safeCreateAction<Arg1, Arg2, Arg3, Arg4, Arg5, P, M = {}>(description: string, payloadReducer: ra.PayloadReducer5<Arg1, Arg2, Arg3, Arg4, Arg5, P>): ra.ComplexActionCreator5<Arg1, Arg2, Arg3, Arg4, Arg5, P, M>;
export function safeCreateAction<Arg1, Arg2, Arg3, Arg4, Arg5, Arg6, P, M = {}>(description: string, payloadReducer: ra.PayloadReducer6<Arg1, Arg2, Arg3, Arg4, Arg5, Arg6, P>): ra.ComplexActionCreator6<Arg1, Arg2, Arg3, Arg4, Arg5, Arg6, P, M>;

export function safeCreateAction(description, payloadReducer?) {
  if (types.has(description)) {
    types.remove(description);
  }
  return createAction(description, payloadReducer);
}
// tslint:enable:max-line-length

export { SimpleActionCreator, ComplexActionCreator1, ComplexActionCreator2 } from 'redux-act';

export default safeCreateAction;
