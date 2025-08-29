export interface IPCHandle {
    pid: number;
    connectionId: string;
    stop: () => Promise<void>;
    kill: () => Promise<void>;
    send: () => Promise<void>;
    close: () => Promise<void>;
}

export interface InstallResult {
    success: boolean;
    error: any;
    sourcePath: string;
    destinationPath: string;
}

export interface FomodInfo {
    name: string;
    author: string;
    version: string;
    steps: any[];
    requiredFiles: any[];
}

export declare function createIPC(options?: Record<string, unknown>): Promise<IPCHandle>;
export declare function killProcess(pid: number): Promise<boolean>;
export declare function install(sourcePath: string, destinationPath: string, options?: any): Promise<InstallResult>;
export declare function parse(fomodPath: string): Promise<FomodInfo>;