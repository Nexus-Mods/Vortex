import makeRemoteCall from './electronRemote';
import { setdefault } from './util';

import { BrowserView, BrowserWindow } from 'electron';
import { generate as shortid } from 'shortid';
import { valueReplacer } from './log';

const extraWebViews: { [contentId: number]: { [viewId: string]: BrowserView } } = {};

export const makeBrowserView = makeRemoteCall<string>('make-browser-view',
   (mainElectron,
    content,
    src: string,
    forwardEvents: string[],
    options: Electron.BrowserViewConstructorOptions) => {

  const viewId = shortid();
  const window = BrowserWindow.fromWebContents(content);
  const view = new mainElectron.BrowserView(options);
  setdefault(extraWebViews, content.id, {})[viewId] = view;

  view.setAutoResize({
    horizontal: true,
    vertical: true,
  });

  window.addBrowserView(view);
  view.webContents.loadURL(src);
  forwardEvents.forEach(eventId => {
    view.webContents.on(eventId as any, (evt, ...args) => {
      content.send(`view-${viewId}-${eventId}`, JSON.stringify(args, valueReplacer()));
      evt.preventDefault();
    });
  });

  return Promise.resolve(viewId);
});

export const closeBrowserView = makeRemoteCall('close-browser-view',
  (mainElectron, content, viewId: string) => {

  if (extraWebViews[content.id]?.[viewId] !== undefined) {
    const window = BrowserWindow.fromWebContents(content);
    window.removeBrowserView(extraWebViews[content.id][viewId]);
    delete extraWebViews[content.id]?.[viewId];
  }
  return Promise.resolve();
  });

export const positionBrowserView = makeRemoteCall('position-browser-view',
  (mainElectron, content, viewId: string, rect: Electron.Rectangle) => {

  extraWebViews[content.id]?.[viewId]?.setBounds?.(rect);
  return Promise.resolve();
  });

export const updateViewURL = makeRemoteCall('update-view-url',
  (mainElectron, content, viewId: string, newURL: string) => {

  extraWebViews[content.id]?.[viewId]?.webContents.loadURL(newURL);
  return Promise.resolve();
  });

export function closeAllViews(window: BrowserWindow) {
    Object.keys(extraWebViews[window.webContents.id] ?? {}).forEach(viewId => {
      window.removeBrowserView(extraWebViews[window.webContents.id][viewId]);
    });
}
