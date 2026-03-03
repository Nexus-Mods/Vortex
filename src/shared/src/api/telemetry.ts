export { SHARED_TELEMETRY_ATTRIBUTES } from "../telemetry/attributes";
export { recordErrorOnSpan } from "../telemetry/spans";
export {
  getProcessor,
  getTracer,
  isTelemetryEnabled,
  setProcessor,
  setTelemetryEnabled,
} from "../telemetry/state";
export { deserializeSpan, serializeSpan } from "../telemetry/types";
export type { SerializedSpan } from "../telemetry/types";
