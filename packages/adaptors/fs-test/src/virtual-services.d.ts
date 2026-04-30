declare module "virtual:services" {
  import type { FileSystem } from "@nexusmods/adaptor-api/fs";
  export const fs: FileSystem;
}
