declare namespace IPC {
  let server: any;
  let client: any;
  let config: any;
  export function serve(path: string, cb: () => void);
  export function connect(path: string);
  export function disconnect();
}

declare module "node-ipc" {
  export = IPC;
}
