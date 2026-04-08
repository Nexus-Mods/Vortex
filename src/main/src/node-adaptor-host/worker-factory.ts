import { Worker } from "node:worker_threads";

export interface IWorkerHandle {
  worker: Worker;
  terminate(): Promise<number>;
}

export function createNodeWorker(scriptPath: string): IWorkerHandle {
  const w = new Worker(scriptPath, {
    execArgv: ["--experimental-vm-modules"],
  });
  return {
    worker: w,
    terminate(): Promise<number> {
      return w.terminate();
    },
  };
}
