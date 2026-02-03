// Main process webview utilities

import type { BrowserView, BrowserWindow } from "electron";

/**
 * Tracks BrowserViews by webContents ID
 * Structure: { [contentsId]: { [viewId]: BrowserView } }
 * Could use a Record type, but this is clearer.
 */
export const extraWebViews: {
  [contentsId: number]: { [viewId: string]: BrowserView };
} = {};

/**
 * Closes all BrowserViews associated with a window
 */
export function closeAllViews(window: BrowserWindow) {
  const contentsId = window.webContents.id;
  const views = extraWebViews[contentsId];

  if (views) {
    // Remove each view from the window and clean up
    Object.values(views).forEach((view) => {
      try {
        window.removeBrowserView(view);
      } catch (_err) {
        // Ignore errors if view is already destroyed
      }
    });

    // Clear all views for this window
    delete extraWebViews[contentsId];
  }
}
