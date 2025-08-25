export interface IPCHandle {
    pid: number;
    stop: () => Promise<void>;
}
export declare function createIPC(options?: Record<string, unknown>): Promise<IPCHandle>;
export declare function killProcess(pid: number): Promise<void>;