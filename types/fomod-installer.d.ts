declare module 'fomod-installer' {
  export interface IPCHandle {
    pid: number;
    connectionId: string;
    stop: () => Promise<void>;
    kill: () => Promise<void>;
    send: () => Promise<void>;
    close: () => Promise<void>;
  }
  
  export function createIPC(options?: Record<string, unknown>): Promise<IPCHandle>;
  export function killProcess(pid: number): Promise<boolean>;
}
