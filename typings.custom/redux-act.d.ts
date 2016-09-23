declare namespace ReduxAct {
    function createAction(description: string);
    function createAction(description: string, transform: Function);
    function createReducer(handlers: { [key: string]: Function }, initState: any): Redux.Reducer<any>;
}

declare module "redux-act" {
    export = ReduxAct
}