import type { HealthCheckId } from "../../types";
import { fileRequirementsContent } from "./FileRequirementsContent";
import { modRequirementsContent } from "./ModRequirementsContent";
import type { IHealthCheckContent } from "./types";

/**
 * Central map of health-check id → its UI content. The shared shell renders
 * whatever is registered here; adding a future check means adding a content
 * module under views/content/ and one entry here — no shell changes.
 */
export const healthCheckContent: Partial<Record<HealthCheckId, IHealthCheckContent>> = {
  "check-nexus-mod-requirements": modRequirementsContent,
  "check-file-level-requirements": fileRequirementsContent,
};
