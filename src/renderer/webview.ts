// Renderer-only webview utilities

export const makeBrowserView = (
  src: string,
  forwardEvents: string[],
  options?: Electron.BrowserViewConstructorOptions,
): Promise<string> => {
  return window.api.browserView.createWithEvents(src, forwardEvents, options);
};

export const closeBrowserView = (viewId: string): Promise<void> => {
  return window.api.browserView.close(viewId);
};

export const positionBrowserView = (
  viewId: string,
  rect: Electron.Rectangle,
): Promise<void> => {
  return window.api.browserView.position(viewId, rect);
};

export const updateViewURL = (
  viewId: string,
  newURL: string,
): Promise<void> => {
  return window.api.browserView.updateURL(viewId, newURL);
};
