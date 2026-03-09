/**
 * Shared OTel resource attributes that apply to all Vortex processes.
 * Both main and renderer spread this into their Resource at startup.
 * Add cross-process attributes here as needed.
 */
export const SHARED_TELEMETRY_ATTRIBUTES: Record<
  string,
  string | number | boolean
> = {
  "deployment.environment": "test",
};
