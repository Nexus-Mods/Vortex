declare module "virtual:services" {
  import type { IPingService } from "@nexusmods/adaptor-api/contracts/ping";
  export const ping: IPingService;
}
