/**
 * Nexus Integration Main Process
 * Handles main process tasks for Nexus integration
 */

import fs from "node:fs";
import path from "node:path";

import getVortexPath from "../getVortexPath";
import { log } from "../logging";

/**
 * Initialize nexus integration in the main process.
 * Cleans up old request log files.
 */
export function initNexusIntegration(): void {
  try {
    const logPath = path.join(getVortexPath("userData"), "network.log");
    const stat = fs.statSync(logPath);
    const now = new Date();

    // Remove log file if it's from a different day
    if (stat.mtime.getUTCDate() !== now.getUTCDate()) {
      fs.rmSync(logPath);
      log("debug", "Removed old nexus request log");
    }
  } catch {
    // Silently ignore errors (file might not exist yet)
  }

  log("info", "nexus integration initialized");
}
