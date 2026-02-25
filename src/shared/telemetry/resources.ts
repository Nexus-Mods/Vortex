import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import os from "os";

/**
 * Create the standard Vortex OTel Resource with common attributes.
 * Used by both the long-lived telemetry provider and the short-lived crash reporter.
 */
export function createVortexResource(
  processType: string,
  appVersion: string,
  extraAttributes?: Record<string, string | number>,
): Resource {
  return new Resource({
    [ATTR_SERVICE_NAME]: "vortex",
    [ATTR_SERVICE_VERSION]: appVersion,
    "deployment.environment": "test",
    "process.type": processType,
    "os.type": os.type(),
    "os.version": os.release(),
    "host.arch": os.arch(),
    ...extraAttributes,
  });
}
