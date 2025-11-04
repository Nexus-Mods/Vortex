import { log } from '../../../util/log';

import { endDialog } from '../actions/installerUI';
import { IInstallerInfo } from '../types/interface';
import { IExtensionApi } from '../../../types/api';

import { hasActiveFomodDialog } from './gameSupport';

export interface IDialogManager {
  startDialogImmediate(info: IInstallerInfo, callback: (err: any) => void): void;
  instanceId: string;
  api: IExtensionApi;
}

interface QueuedDialogRequest {
  info: IInstallerInfo;
  instanceId: string;
  callback: (err) => void;
  timestamp: number;
  uiInstance: IDialogManager;
}

// Shared static queue across all UI instances to prevent race conditions
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

          this.processNext(store).catch(err => {
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
    info: IInstallerInfo,
    callback: (err) => void,
    uiInstance: IDialogManager): Promise<void> {
    this.queue.push({
      info,
      callback,
      timestamp: Date.now(),
      uiInstance,
      instanceId: uiInstance.instanceId
    });

    // Trigger queue processing immediately if no dialog is active
    if (!hasActiveFomodDialog(uiInstance.api.store)) {
      log('debug', 'No active dialog detected, triggering immediate queue processing');
      setTimeout(() => {
        this.processNext(uiInstance.api.store).catch(err => {
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
            request.uiInstance.startDialogImmediate(request.info, (err) => {
              if (err) {
                log('error', 'Dialog failed to start', {
                  moduleName: request.info.moduleName,
                  error: err.message,
                  errorCode: err.code
                });

                // Check if this is an installer executable failure
                if (err.message.includes('ModInstallerIPC.exe') ||
                    err.message.includes('FOMOD installer executable') ||
                    err.message.includes('Failed to resolve full path') ||
                    err.message.includes('exited with code') ||
                    err.code === 'ENOENT' ||
                    err.code === 'EACCES') {
                  log('warn', 'FOMOD installer executable failure detected in queue processing', {
                    moduleName: request.info.moduleName,
                    error: err.message,
                    code: err.code
                  });
                }

                this.onDialogEnd(store);
              }

              request.callback(err);
            });
          } catch (err) {
            this.onDialogEnd(store);
            request.callback(err);
            // Try next request after a brief delay
            setTimeout(() => this.processNext(store), 100);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  onDialogEnd(store: any): void {
    const activeInstanceId = store.getState()?.session?.fomod?.installer?.dialog?.activeInstanceId;
    store.dispatch(endDialog(activeInstanceId));
    // Remove the active dialog from the queue if it exists
    this.queue = this.queue.filter(request => request.instanceId !== activeInstanceId);

    // Process next request after a brief delay
    setTimeout(() => {
      log('debug', 'Triggering queue processing after dialog end');
      this.processNext(store).catch(err => {
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
    // Notify all queued requests
    this.queue.forEach(request => {
      request.callback(new Error('Dialog queue cleared'));
    });
    this.queue = [];
    this.processing = false;
  }

}