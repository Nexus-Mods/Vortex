/**
 * Safe IPC action replay handler that prevents renderer-to-renderer dispatch
 * of any renderer-originated action as IPC and avoids re-dispatching to other renderers
 */

import { ipcRenderer } from 'electron';
import { Store } from 'redux';

const RENDERER_ID = `renderer-${process.pid}-${Date.now()}`;

export function safeReplayActionRenderer(store: Store) {
  if (!ipcRenderer) {
    return;
  }

  ipcRenderer.on('redux-action', (event, payload) => {
    try {
      const action = JSON.parse(payload);

      // Don't replay actions that originated from ANY renderer
      // This prevents IPC loops between different renderer processes
      if (action.meta?.origin && action.meta.origin.startsWith('renderer-')) {
        console.log(`[IPC] Skipping renderer-originated action: ${action.type} from ${action.meta.origin}`);
        return;
      }

      // Mark action as coming from IPC to prevent forwarding loops
      const actionWithIPCFlag = {
        ...action,
        meta: {
          ...action.meta,
          fromIPC: true,
        },
      };

      store.dispatch(actionWithIPCFlag);
    } catch (err) {
      console.error('Failed to replay action from main process:', err);
    }
  });
}

export default safeReplayActionRenderer;