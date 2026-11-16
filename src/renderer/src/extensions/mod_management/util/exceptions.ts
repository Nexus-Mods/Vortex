export class NoDeployment extends Error {
  constructor() {
    super("No supported deployment method");
    this.name = this.constructor.name;
    this["allowReport"] = false;
  }
}

/**
 * A collection member install the stall watchdog gave up on. The install itself isn't cancelled,
 * it may still be running, so the member must not be requeued: a retry would start a second
 * install of the same archive.
 */
export class InstallationTimeoutError extends Error {
  constructor(waitedMs: number) {
    super(`Installation timed out after ${Math.max(1, Math.round(waitedMs / 60000))} minutes`);
    this.name = "InstallationTimeoutError";
  }
}
