import { log } from '../../../util/log';

import { IExtensionApi } from '../../../types/api';

import { hasActiveFomodDialog } from './helpers';
import { hasSessionFOMOD } from './guards';

export interface IDialogManager {
  startDialogImmediate(): void;
  cancelDialogImmediate(): void;
  instanceId: string;
  api: IExtensionApi;
}

interface QueuedDialogRequest {
  instanceId: string;
  timestamp: number;
  uiInstance: IDialogManager;
}

// Shared static queue across all UI instances to prevent race conditions
export class DialogQueue {
  private static instance: DialogQueue;

  private api: IExtensionApi;
  private queue: QueuedDialogRequest[] = [];
  private processing: boolean = false;
  private periodicChecker: NodeJS.Timeout | null = null;

  private constructor(api: IExtensionApi) {
    this.api = api;
    this.startPeriodicChecker(api);
  }

  private startPeriodicChecker = (api: IExtensionApi): void => {
    // Check every 5s seconds for stuck queues
    this.periodicChecker = setInterval(() => {
      const state = api.getState();
      if (!state || !hasSessionFOMOD(state.session)) {
        return false;
      }

      const activeInstanceId = state.session.fomod.installer?.dialog?.activeInstanceId;
      // If the current active dialog is stale, cancel it and remove it from the queue
      // Should only happen if UpdateState wasn't called for some reason
      for (const request of this.queue) {
        if (request.instanceId !== activeInstanceId) {
          continue;
        }

        if (request.timestamp + 5000 < Date.now()) { // 5 seconds
          log('warn', 'Removing stale dialog request from queue', { instanceId: request.instanceId });
          request.uiInstance.cancelDialogImmediate();
          this.queue = this.queue.filter(r => r !== request);
        }
      }
    }, 5000); // 5 seconds
  }

  destroy = (): void => {
    if (this.periodicChecker) {
      clearInterval(this.periodicChecker);
      this.periodicChecker = null;
    }
  }

  public static getInstance = (api: IExtensionApi): DialogQueue => {
    if (!DialogQueue.instance) {
      DialogQueue.instance = new DialogQueue(api);
    }
    return DialogQueue.instance;
  }

  public enqueueDialog = (uiInstance: IDialogManager): void => {
    this.queue.push({
      timestamp: Date.now(),
      uiInstance,
      instanceId: uiInstance.instanceId
    });
  }

  public processNext = (): void => {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Double-check no dialog became active while we were waiting
      if (hasActiveFomodDialog(this.api)) {
        return;
      }

      const request = this.queue.shift();
      if (!request) {
        return;
      }

      request.uiInstance.startDialogImmediate();
    } finally {
      this.processing = false;
    }
  }

  public onDialogEnd = (instanceId: string): void => {
    // Remove from queue if still present
    const request = this.queue.find(r => r.instanceId === instanceId);
    if (request) {
      this.queue = this.queue.filter(r => r !== request);
    }

    // Process next queued dialog
    this.processNext();
  }

  public getStatus = () => {
    return {
      queueLength: this.queue.length,
      isProcessing: this.processing,
    };
  }

  public clear = (): void => {
    this.queue = [];
    this.processing = false;
  }
}