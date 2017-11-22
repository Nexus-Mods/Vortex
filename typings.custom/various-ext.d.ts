interface NodeModule {
  hot: any;
}

declare namespace NodeJS {
  interface Global {
    logger: any;
  }
}

// the electron-builder-http typings use the wrong type name...
declare namespace debug {
  type Debugger = any;
}

interface NodeModule {
  paths: string[];
}

interface IWebView {
  src?: string;
  autosize?: boolean;
  nodeintegration?: boolean;
  plugins?: boolean;
  preload?: string;
  httpreferrer?: string;
  useragent?: string;
  disablewebsecurity?: boolean;
  partition?: string;
  allowpopups?: boolean;
  webpreferences?: string;
  blinkfeatures?: string;
  disableblinkfeatures?: string;
  guestinstance?: string;
}

declare module 'module' {
  export var _initPaths: () => void;
}
