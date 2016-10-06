declare module "drivelist" {
  interface Callback {
    (err, disks): void;
  }
  export function list(cb: Callback);
}

