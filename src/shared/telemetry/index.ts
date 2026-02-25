export { createVortexResource } from "./resources";
export { RingBufferSpanProcessor } from "./RingBufferSpanProcessor";
export type { RingBufferOptions } from "./RingBufferSpanProcessor";
export {
  createTelemetryProvider,
  getProcessor,
  getResource,
  getTracer,
  isTelemetryEnabled,
  setServiceVersion,
  setTelemetryEnabled,
} from "./setup";
export type { TelemetrySetupResult } from "./setup";
export { recordErrorOnSpan } from "./spans";
