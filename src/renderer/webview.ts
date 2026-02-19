// Renderer-only webview utilities

import { getPreloadApi } from "./util/preloadAccess";

export const makeBrowserView = (
  src: string,
  forwardEvents: string[],
  options?: Electron.BrowserViewConstructorOptions,
): Promise<string> => {
  return getPreloadApi().browserView.createWithEvents(
    src,
    forwardEvents,
    options,
  );
};

export const closeBrowserView = (viewId: string): Promise<void> => {
  return getPreloadApi().browserView.close(viewId);
};

export const positionBrowserView = (
  viewId: string,
  rect: Electron.Rectangle,
): Promise<void> => {
  return getPreloadApi().browserView.position(viewId, rect);
};

export const updateViewURL = (
  viewId: string,
  newURL: string,
): Promise<void> => {
  return getPreloadApi().browserView.updateURL(viewId, newURL);
};
