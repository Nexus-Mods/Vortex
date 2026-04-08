declare module "virtual:services" {
  import type { IFileSystemService } from "@vortex/adaptor-api/contracts/filesystem";
  export const filesystem: IFileSystemService;
}
