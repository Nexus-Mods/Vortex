import { types as vetypes } from 'fomod-installer-native';
import { DialogManager } from './DialogManager';
import { endDialog } from '../../installer_fomod_shared/actions/installerUI';
import { hasActiveFomodDialog } from '../../installer_fomod_shared/util/gameSupport';
import { log } from '../../../util/log';

interface QueuedDialogRequest {
  moduleName: string;
  image: vetypes.IHeaderImage;
  selectCallback: vetypes.SelectCallback;
  contCallback: vetypes.ContinueCallback;
  cancelCallback: vetypes.CancelCallback;
  instanceId: string;
  timestamp: number;
  uiInstance: DialogManager;
}

/**
 * Shared static queue across all DialogManager instances to prevent race conditions
 * Ensures only one FOMOD dialog is active at a time
 */
export class DialogQueue {
  private static instance: DialogQueue;
  private queue: QueuedDialogRequest[] = [];
  private processing: boolean = false;
  private periodicChecker: NodeJS.Timeout | null = null;

  private constructor() {
    this.startPeriodicChecker();
  }

  static getInstance(): DialogQueue {
    if (!DialogQueue.instance) {
      DialogQueue.instance = new DialogQueue();
    }
    return DialogQueue.instance;
  }

  private startPeriodicChecker(): void {
    // Check every 3 seconds for stuck queues
    this.periodicChecker = setInterval(() => {
      if (this.queue.length > 0 && !this.processing) {
        log('debug', 'Periodic queue check detected unprocessed items', {
          queueLength: this.queue.length,
          processing: this.processing,
        });

        // Try to get store from the first queue item's UI instance
        if (this.queue[0] && this.queue[0].uiInstance && this.queue[0].uiInstance.api) {
          const store = this.queue[0].uiInstance.api.store;

          this.processNext(store).catch((err) => {
            log('error', 'Periodic queue processing failed', { error: err.message });
          });
        }
      }
    }, 3000);
  }

  destroy(): void {
    if (this.periodicChecker) {
      clearInterval(this.periodicChecker);
      this.periodicChecker = null;
    }
  }

  async addRequest(
    moduleName: string,
    image: vetypes.IHeaderImage,
    selectCallback: vetypes.SelectCallback,
    contCallback: vetypes.ContinueCallback,
    cancelCallback: vetypes.CancelCallback,
    uiInstance: DialogManager,
    store: any
  ): Promise<void> {
    this.queue.push({
      moduleName,
      image,
      selectCallback,
      contCallback,
      cancelCallback,
      timestamp: Date.now(),
      uiInstance,
      instanceId: uiInstance.instanceId,
    });

    // Trigger queue processing immediately if no dialog is active
    if (!hasActiveFomodDialog(store)) {
      log('debug', 'No active dialog detected, triggering immediate queue processing');
      setTimeout(() => {
        this.processNext(store).catch((err) => {
          log('error', 'Failed to process queue immediately', { error: err.message });
        });
      }, 10);
    }
  }

  async processNext(store: any): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      if (this.queue.length > 0 && !hasActiveFomodDialog(store)) {
        const request = this.queue.shift();
        if (request) {
          try {
            request.uiInstance.startDialogImmediate(
              request.moduleName,
              request.image,
              request.selectCallback,
              request.contCallback,
              request.cancelCallback
            );
          } catch (err) {
            log('error', 'Dialog failed to start', {
              moduleName: request.moduleName,
              error: err.message,
            });
            this.onDialogEnd(store);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  onDialogEnd(store: any): void {
    const state = store.getState();
    const activeInstanceId = state?.session?.fomod?.installer?.dialog?.activeInstanceId;
    if (activeInstanceId) {
      store.dispatch(endDialog(activeInstanceId));
    }

    // Process next request after a brief delay
    setTimeout(() => {
      log('debug', 'Triggering queue processing after dialog end');
      this.processNext(store).catch((err) => {
        log('error', 'Failed to process dialog queue after dialog end', { error: err.message });
      });
    }, 50);
  }

  getStatus(): any {
    return {
      queueLength: this.queue.length,
      isProcessing: this.processing,
    };
  }

  clear(): void {
    // Clear all queued requests
    this.queue = [];
    this.processing = false;
  }
}