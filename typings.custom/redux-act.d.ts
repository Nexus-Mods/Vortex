declare namespace ReduxAct {
    function createAction(description: string);
    function createAction(description: string, transform: Function);
    function createReducer(handlers: any, initState: any);
}

declare module "redux-act" {
    export = ReduxAct
}