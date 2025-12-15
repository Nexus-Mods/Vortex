/**
 * Enhanced forwardToMain middleware that prevents IPC loops
 * This middleware adds proper origin tracking to prevent actions
 * from being replayed back to other renderer processes.
 *
 * It also ensures that only valid actions (with a type) are forwarded.
 */

import { ipcRenderer } from "electron";
import { Middleware } from "redux";

const RENDERER_ID = `renderer-${process.pid}-${Date.now()}`;

interface ActionWithMeta {
  type: string;
  meta?: {
    origin?: string;
    fromIPC?: boolean;
  };
  [key: string]: any;
}

const safeForwardToMain: Middleware =
  (store) => (next) => (action: ActionWithMeta) => {
    // Validate action has a type - if not, let Redux handle the error normally
    if (!action || typeof action.type !== "string") {
      return next(action);
    }

    // Don't forward actions that came from IPC to prevent loops
    if (action.meta?.fromIPC) {
      // console.log(`[IPC] Skipping IPC-originated action: ${action.type}`);
      return next(action);
    }

    // Add origin tracking only for valid actions
    const actionWithOrigin = {
      ...action,
      meta: {
        ...action.meta,
        origin: RENDERER_ID,
      },
    };

    // Process action locally first
    const result = next(actionWithOrigin);

    // Forward to main process only for valid actions
    if (ipcRenderer) {
      try {
        // console.log(`[IPC] Forwarding to main: ${action.type} from ${RENDERER_ID}`);
        ipcRenderer.send("redux-action", JSON.stringify(actionWithOrigin));
      } catch (err) {
        console.error("Failed to forward action to main process:", err);
      }
    }

    return result;
  };

export default safeForwardToMain;
