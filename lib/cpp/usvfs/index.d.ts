export interface IUSVFSParameters {
  instanceName: string;
  debugMode: boolean;
  logLevel: 0 | 1 | 2 | 3;
  crashDumpType: 0 | 1 | 2 | 3;
  crashDumpPath: string;
}

export interface ILinkParameters {
  failIfExists?: boolean;
  monitorChanges?: boolean;
  createTarget?: boolean;
  recursive?: boolean;
}

export function createVFS(params: IUSVFSParameters);
export function connectVFS(params: IUSVFSParameters);
export function disconnectVFS();

export function clearMappings();
export function linkFile(source: string, destination: string, parameters: ILinkParameters);
export function linkDirectory(source: string, destination: string, parameters: ILinkParameters);

export interface IExecOptions {
  cwd?: string;
  env?: { [key: string]: string };
}

export function exec(command: string, options: IExecOptions);
