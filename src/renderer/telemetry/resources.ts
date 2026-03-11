import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { SHARED_TELEMETRY_ATTRIBUTES } from "@vortex/shared/telemetry";
import os from "os";

/**
 * Create the standard Vortex OTel Resource for the renderer process.
 * Mirrors the main-process createVortexResource but runs in the renderer.
 */
export const createRendererResource = (version: string): Resource => {
  return new Resource({
    ...SHARED_TELEMETRY_ATTRIBUTES,
    [ATTR_SERVICE_NAME]: "vortex",
    [ATTR_SERVICE_VERSION]: version,
    "process.type": "renderer",
    "process.pid": process.pid,
    "os.type": os.type(),
    "os.version": os.release(),
    "host.arch": os.arch(),
  });
}
