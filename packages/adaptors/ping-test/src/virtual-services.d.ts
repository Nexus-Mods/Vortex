declare module "virtual:services" {
  import type { IPingService } from "@vortex/adaptor-api/contracts/ping";
  export const ping: IPingService;
}
