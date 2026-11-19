import { createHash } from "node:crypto";

// TRUST & SAFETY SIGN-OFF REQUIRED before release: a stable per-install ID sent to Unleash on every
// flag fetch, regardless of analytics consent. It keeps an install in one experiment cohort across
// launches; without it, logged-out installs fall back to a per-launch sessionId. Salted, so it
// can't be matched to the raw instance ID.

const SALT = "vortex-experiment-cohort:";

/** The install's experiment-cohort hash: hex SHA-256 of the salted instance ID. */
export const experimentCohortHash = (instanceId: string): string =>
  createHash("sha256")
    .update(SALT + instanceId)
    .digest("hex");
