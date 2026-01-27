/** Globals exposed by the preload script to the renderer */
export interface PreloadWindow {
  api: Api;

  /** Environment version information */
  versions: Versions;
}

/** All API methods available to the renderer */
export interface Api {
  /** Example APIs */
  example: Example;
}

export interface Example {
  /** pong */
  ping(): Promise<string>;
}

export interface Versions {
  node: string;
  chromium: string;
  electron: string;
}
