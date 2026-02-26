export { RingBufferSpanProcessor } from "./RingBufferSpanProcessor";
export type { RingBufferOptions } from "./RingBufferSpanProcessor";
export { recordErrorOnSpan } from "./spans";
export {
  getProcessor,
  getTracer,
  isTelemetryEnabled,
  setProcessor,
  setTelemetryEnabled,
} from "./state";
export { deserializeSpan, serializeSpan } from "./types";
export type { SerializedSpan } from "./types";
