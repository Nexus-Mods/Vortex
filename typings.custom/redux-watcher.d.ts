interface WatcherCallback {
  store: Redux.Store<any>;
  selector: string;
  prevState: any;
  currentState: any;
  prevValue: any;
  currentValue: any;
}

declare module "redux-watcher" {
  class ReduxWatcher {
    constructor(store: Redux.Store<any>);

    public watch(path: string[], callback: (res: WatcherCallback) => void);
  }

  export = ReduxWatcher;
}
