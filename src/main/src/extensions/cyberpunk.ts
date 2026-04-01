import { getErrorMessageOrDefault } from "@vortex/shared";

import { log } from "../logging";
import { setupCyberpunkHandlers } from "../games/cyberpunk";

let initialized = false;

export function initCyberpunk(): void {
  if (initialized) {
    return;
  }

  try {
    setupCyberpunkHandlers();
    initialized = true;
    log("info", "cyberpunk main-process support initialized");
  } catch (err) {
    log(
      "error",
      "failed to initialize cyberpunk main-process support",
      getErrorMessageOrDefault(err),
    );
  }
}
