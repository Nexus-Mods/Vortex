import {IExtensionApi} from '../../../types/IExtensionContext';
import { log } from '../../../util/log';
import {showError} from '../../../util/message';
import { truthy } from '../../../util/util';

import {endDialog, setDialogState, startDialog} from '../actions/installerUI';
import {IInstallerInfo, IInstallerState, IReportError, StateCallback} from '../types/interface';

import DelegateBase from './DelegateBase';

import { hasActiveFomodDialog } from '../util/gameSupport';
import { inspect } from 'util';

interface QueuedDialogRequest {
  info: IInstallerInfo;
  instanceId: string;
  callback: (err) => void;
  timestamp: number;
  uiInstance: UI;
}

// Shared static queue across all UI instances to prevent race conditions
class DialogQueue {
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

  async addRequest(info: IInstallerInfo, callback: (err) => void, uiInstance: UI, store: any): Promise<void> {
    this.queue.push({
      info,
      callback,
      timestamp: Date.now(),
      uiInstance,
      instanceId: uiInstance.instanceId
    });

    // Trigger queue processing immediately if no dialog is active
    if (!hasActiveFomodDialog(store)) {
      log('debug', 'No active dialog detected, triggering immediate queue processing');
      setTimeout(() => {
        this.processNext(store).catch(err => {
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
    endDialog(activeInstanceId);

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

class UI extends DelegateBase {
  private mStateCB: StateCallback;
  private mUnattended: boolean;
  private mContinueCB: (direction) => void;
  private mCancelCB: () => void;
  private mInstanceId: string;
  private static dialogQueue = DialogQueue.getInstance();

  get instanceId(): string {
    return this.mInstanceId;
  }

  constructor(api: IExtensionApi, gameId: string, unattended: boolean, instanceId: string) {
    super(api);

    this.mUnattended = unattended;
    this.mInstanceId = instanceId;

    // Use bound methods to avoid conflicts between multiple instances
    this.onDialogSelect = this.onDialogSelect.bind(this);
    this.onDialogContinue = this.onDialogContinue.bind(this);
    this.onDialogEnd = this.onDialogEnd.bind(this);

    // Use instance-specific event names to avoid conflicts
    api.events
      .on(`fomod-installer-select-${this.mInstanceId}`, this.onDialogSelect)
      .on(`fomod-installer-continue-${this.mInstanceId}`, this.onDialogContinue)
      .on(`fomod-installer-cancel-${this.mInstanceId}`, this.onDialogEnd);

    log('debug', 'Created UI instance', { instanceId: this.mInstanceId });
  }

  public detach() {
    log('debug', 'Detaching UI instance', { instanceId: this.mInstanceId });

    this.api.events
      .removeListener(`fomod-installer-select-${this.mInstanceId}`, this.onDialogSelect)
      .removeListener(`fomod-installer-continue-${this.mInstanceId}`, this.onDialogContinue)
      .removeListener(`fomod-installer-cancel-${this.mInstanceId}`, this.onDialogEnd);

    this.mContinueCB = this.mStateCB = this.mCancelCB = undefined;
    if (this.mInstanceId !== null) {
      log('debug', 'Detaching UI instance that had active dialog', {
        instanceId: this.mInstanceId,
        queueStatus: UI.dialogQueue.getStatus()
      });

      UI.dialogQueue.onDialogEnd(this.api.store);
    }
  }

  public startDialog = async (info: IInstallerInfo, callback: (err) => void) => {
    this.mContinueCB = info.cont;
    this.mStateCB = info.select;
    this.mCancelCB = info.cancel;
    await UI.dialogQueue.addRequest(info, callback, this, this.api.store);
  }

  public startDialogImmediate = (info: IInstallerInfo, callback: (err) => void) => {
    try {
      if (!this.mUnattended) {
        this.api.store.dispatch(startDialog(info, this.mInstanceId));
      }
      callback(null);
    } catch (err) {
      log('error', 'Failed to start FOMOD dialog', {
        moduleName: info.moduleName,
        error: err.message
      });
      showError(this.api.store.dispatch, 'start installer dialog failed', err);
      callback(err);
    }
  }

  public endDialog = (dummy, callback: (err) => void) => {
    try {
      this.api.store.dispatch(endDialog(this.mInstanceId));
      callback(null);

      // Process any queued dialog requests
      UI.dialogQueue.onDialogEnd(this.api.store);

    } catch (err) {
      showError(this.api.store.dispatch, 'end installer dialog failed', err);
      callback(err);
    }
    // unset the callbacks because they belong to c# so having links here
    // might prevent the c# object from being cleaned up
    this.mContinueCB = this.mStateCB = this.mCancelCB = undefined;
  }

  public updateState = (state: IInstallerState, callback: (err) => void) => {
    try {
      this.api.store.dispatch(setDialogState(state, this.mInstanceId));
      if (this.mUnattended) {
        if (this.mContinueCB !== undefined) {
          this.mContinueCB({ direction: 'forward' });
        }
      }
      callback(null);
    } catch (err) {
      showError(this.api.store.dispatch, 'update installer dialog failed',
        err);
      callback(err);
    }
  }

  public reportError = (parameters: IReportError, callback: (err) => void) => {
    log('debug', 'reportError', inspect(parameters, null));
    try {
      let msg = parameters.message;
      if (truthy(parameters.details)) {
        msg += '\n' + parameters.details;
      }
      this.api.showErrorNotification(parameters.title, parameters.details ?? undefined,
        { isHTML: true, allowReport: false, message: parameters.message });
      callback(null);
    } catch (err) {
      showError(this.api.store.dispatch,
        'Failed to display error message from installer', err);
      callback(err);
    }
  }

  private onDialogSelect = (stepId: string, groupId: string, pluginIds: string[]) => {
    if (this.mStateCB !== undefined) {
      this.mStateCB({
        stepId: parseInt(stepId, 10),
        groupId: parseInt(groupId, 10),
        plugins: pluginIds.map(id => parseInt(id, 10))
      });
    }
  }

  private onDialogContinue = (direction, currentStepId: number) => {
    if (this.mContinueCB !== undefined) {
      this.mContinueCB({ direction, currentStepId });
    }
  }

  private onDialogEnd = () => {
    if (this.mCancelCB !== undefined) {
      this.mCancelCB();
    }

    UI.dialogQueue.onDialogEnd(this.api.store);
  }
}

export default UI;
