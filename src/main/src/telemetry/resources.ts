import os from "os";

import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { SHARED_TELEMETRY_ATTRIBUTES } from "@vortex/shared/telemetry";
import { app } from "electron";

/**
 * Create the standard Vortex OTel Resource with common attributes.
 * Used by both the long-lived telemetry provider and the short-lived crash reporter.
 */
export const createVortexResource = (processType: string): Resource => {
  return new Resource({
    ...SHARED_TELEMETRY_ATTRIBUTES,
    [ATTR_SERVICE_NAME]: "vortex",
    [ATTR_SERVICE_VERSION]: app.getVersion(),
    "process.type": processType,
    "process.pid": process.pid,
    "os.type": os.type(),
    "os.version": os.release(),
    "host.arch": os.arch(),
  });
};
