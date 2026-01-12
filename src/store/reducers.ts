import { BaseActionCreator, ComplexActionCreator } from "redux-act";

export type ReducerHandler<S, P> = (state: S, payload: P) => S;
export const createReducer = <S, P, M>(
  actionCreator: BaseActionCreator<ComplexActionCreator<P, M>>,
  action: ReducerHandler<S, P>,
  reducers: { [key: string]: ReducerHandler<S, any> },
) => {
  reducers[actionCreator.getType()] = action;
};
