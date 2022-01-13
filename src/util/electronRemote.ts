import { ipcMain, ipcRenderer } from 'electron';
import * as electron from 'electron';
import { generate as shortid } from 'shortid';
import { log } from './log';

const IPC_CHANNEL = '__remote_electron_invocation';
const IPC_CHANNEL_REPLY = IPC_CHANNEL + '_reply';

type StoredCB = (mainElectron: typeof electron, ...args: any[]) => Promise<any>;
type StoredSyncCB = (mainElectron: typeof electron, ...args: any[]) => any;

const knownCalls: { [id: string]: StoredCB } = {};
const knownCallsSync: { [id: string]: StoredSyncCB } = {};

interface IOutstandingCall {
  resolve: (res: any) => void;
  reject: (err: Error) => void;
}

const outstandingCalls: { [callId: string]: IOutstandingCall } = {};

ipcMain?.on?.(IPC_CHANNEL, async (event, arg) => {
  const { id, callId, args } = JSON.parse(arg);
  if (knownCalls[id] === undefined) {
    event.sender.send(IPC_CHANNEL_REPLY,
                      JSON.stringify({ callId, error: new Error('invalid remote call') }));
    return;
  }

  try {
    const result = await knownCalls[id](electron, event.sender, ...args);
    event.sender.send(IPC_CHANNEL_REPLY, JSON.stringify({ callId, result }));
  } catch (error) {
    event.sender.send(IPC_CHANNEL_REPLY, JSON.stringify({ callId, error }));
  }
});

ipcRenderer?.on?.(IPC_CHANNEL_REPLY, (event, arg) => {
  const { callId, error, result } = JSON.parse(arg);
  if (outstandingCalls[callId] === undefined) {
    log('warn', 'unexpected remote reply', arg);
    return;
  }

  if (error !== undefined) {
    outstandingCalls[callId].reject(error);
  } else {
    outstandingCalls[callId].resolve(result);
  }
  delete outstandingCalls[callId];
});

ipcMain?.on?.(IPC_CHANNEL, (event, arg) => {
  const { id, callId, args } = JSON.parse(arg);
  try {
    event.returnValue = {
      error: null,
      result: knownCallsSync[id](electron, event.sender, ...args)
    };
  } catch (error) {
    event.returnValue = { error };
  }
});

export function makeRemoteCallSync<T>(
  id: string,
  cb: (mainElectron: typeof electron, window: electron.WebContents, ...args: any[]) => T)
  : (...args: any[]) => T {

  if (ipcRenderer !== undefined) {
    return (...args: any[]) => {
      const callId = shortid();
      const res = ipcRenderer.sendSync(IPC_CHANNEL, JSON.stringify({ id, args, callId }));
      if (res.error !== null) {
        throw res.error;
      } else {
        return res.result;
      }
    };
  } else {
    knownCallsSync[id] = cb;
    return (...args: any[]) => {
      return cb(electron, electron.webContents?.getFocusedWebContents?.(), ...args);
    };
  }
}

function makeRemoteCall<T>(id: string,
                           cb: (mainElectron: typeof electron,
                                window: electron.WebContents,
                                ...args: any[]) => Promise<T>)
                           : (...args: any[]) => Promise<T> {
  if (ipcRenderer !== undefined) {
    return (...args: any[]) => {
      const callId = shortid();
      ipcRenderer.send(IPC_CHANNEL, JSON.stringify({ id, args, callId }));
      return new Promise<T>((resolve, reject) => {
        outstandingCalls[callId] = { resolve, reject };
      });
    };
  } else {
    knownCalls[id] = cb;
    return (...args: any[]) => {
      return cb(electron, electron.webContents.getFocusedWebContents(), ...args);
    };
  }
}

export default makeRemoteCall;
