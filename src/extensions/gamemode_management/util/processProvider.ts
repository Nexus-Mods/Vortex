import psList from "ps-list";

export interface IProcessInfo {
  pid: number;
  ppid: number;
  name: string;
  cmd?: string;
  path?: string;
}

export interface IProcessProvider {
  list(): Promise<IProcessInfo[]>;
}

export class PsListProcessProvider implements IProcessProvider {
  public async list(): Promise<IProcessInfo[]> {
    const processes = await psList({ all: true });
    return processes.map((proc) => ({
      pid: proc.pid,
      ppid: proc.ppid,
      name: proc.name,
      cmd: proc.cmd,
      // ps-list doesn't provide a 'path' property; it must be derived from 'cmd'
    }));
  }
}

export const defaultProcessProvider = new PsListProcessProvider();
