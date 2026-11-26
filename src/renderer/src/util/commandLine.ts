import { getPreloadApi } from "./preloadAccess";

let relaunching = false;

export function relaunch(args?: string[]) {
  relaunching = true;
  getPreloadApi().app.relaunch(args);
}

/** True once this session has asked main to restart, so the close that follows is a restart. */
export function isRelaunching(): boolean {
  return relaunching;
}
