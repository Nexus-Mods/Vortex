/**
 * Preload script for BrowserViews (embedded browser for downloading from external sites)
 *
 * This provides minimal polyfills for Node.js globals that external websites
 * may expect when using bundled JavaScript (Webpack/Browserify targets both Node and browser)
 */

import { Buffer } from "buffer";
import { contextBridge } from "electron";

// Expose Buffer to the page context via contextBridge
// With contextIsolation, only contextBridge can pass objects to the page
// This makes window.Buffer available for websites that bundle for both Node and browser
contextBridge.exposeInMainWorld("Buffer", Buffer);
