interface NodeModule {
  hot: any
}

declare namespace Electron {
  interface Session {
    protocol: any
  }
}

declare namespace NodeJS {
  interface Process {
    type: string
  }
  interface Global {
    logger: any;
  }

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

declare module JSX {
  interface IntrinsicElements {
    webview: IWebView,
  }
}

declare module 'module' {
  export var _initPaths: () => void;
}
