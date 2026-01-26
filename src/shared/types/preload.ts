export interface PreloadWindow {
  api: Api;
  versions: Versions;
}

export interface Api {
  ping(): Promise<string>;
}

export interface Versions {
  node: string;
  chromium: string;
  electron: string;
}
