export { SHARED_TELEMETRY_ATTRIBUTES } from "../telemetry/attributes";
export {
  bucketCount,
  BUCKETED_ATTRIBUTES,
  RESOURCE_ATTRIBUTE_ALLOWLIST,
  sanitizeResourceAttributes,
  sanitizeSpan,
  sanitizeSpanAttributes,
  SanitizingSpanExporter,
  SPAN_ATTRIBUTE_ALLOWLIST,
} from "../telemetry/sanitizer";
export { recordErrorOnSpan } from "../telemetry/spans";
export { deserializeSpan, serializeSpan } from "../telemetry/types";
export type { SerializedSpan } from "../telemetry/types";
