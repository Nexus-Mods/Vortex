import { getPreloadApi } from "./preloadAccess";

export function relaunch(args?: string[]) {
  getPreloadApi().app.relaunch(args);
}
