export interface PreloadWindow {
  api: Api;
  versions: Versions;
}

export interface Api {}

export interface Versions {
  node: string;
  chromium: string;
  electron: string;
}
