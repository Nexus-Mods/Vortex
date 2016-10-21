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
