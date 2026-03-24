// Main process webview utilities

import type { WebContentsView, BrowserWindow } from "electron";

/**
 * Tracks WebContentsViews by webContents ID
 * Structure: { [contentsId]: { [viewId]: WebContentsView } }
 */
export const extraWebViews: {
  [contentsId: number]: { [viewId: string]: WebContentsView };
} = {};

/**
 * Closes all WebContentsViews associated with a window
 */
export function closeAllViews(window: BrowserWindow) {
  const contentsId = window.webContents.id;
  const views = extraWebViews[contentsId];

  if (views) {
    Object.values(views).forEach((view) => {
      try {
        window.contentView.removeChildView(view);
      } catch (_err) {
        // Ignore errors if view is already destroyed
      }
    });

    delete extraWebViews[contentsId];
  }
}
