/** Globals exposed by the preload script to the renderer */
export interface PreloadWindow {
  api: Api;

  environment: Environment;
}

/** All API methods available to the renderer */
export interface Api {
  /** Electron related APIs */
  app: App;

  /** Example APIs */
  example: Example;
}

export interface App {
  /** Gets the electron app version */
  getAppVersion(): Promise<string>;

  /** Gets the electron app name */
  getAppName(): Promise<string>;

  /** Tries to close all windows successfully and then terminates the app */
  quit(): void;

  /** App immediately exists */
  exit(exitCode?: number): void;
}

export interface Environment {
  /** Node.js version */
  node: string;

  /** Chromium version */
  chromium: string;

  /** Electron version */
  electron: string;
}

export interface Example {
  /** pong */
  ping(): Promise<string>;
}
