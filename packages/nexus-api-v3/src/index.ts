export type { paths, components, operations } from "./generated/nexus-api-v3";
// Internal (x-badges: Internal) endpoints, codegen'd from the vendored telemetry fragment. Aliased
// so they don't collide with the public paths/components above.
export type {
  paths as internalPaths,
  components as internalComponents,
  operations as internalOperations,
} from "./generated/nexus-api-v3-internal";
export {
  createNexusV3Client,
  createNexusV3InternalClient,
  type NexusV3Client,
  type NexusV3ClientOptions,
  type NexusV3InternalClient,
} from "./client";
export { V3ApiError } from "./errors";
export { uploadHeadersFor, type UploadHeaders } from "./uploadHeaders";
export type { Middleware as NexusV3Middleware } from "openapi-fetch";
