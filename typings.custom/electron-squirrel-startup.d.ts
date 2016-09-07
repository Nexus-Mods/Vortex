declare namespace ReduxAct {
    function createAction(description: string);
    function createAction(description: string, transform: Function);
    function createReducer(handlers: any, initState: any);
}

declare module "electron-squirrel-startup" {
    export default true
}