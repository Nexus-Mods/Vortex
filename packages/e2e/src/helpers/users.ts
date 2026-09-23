export interface NexusUser {
  username: string;
  password: string;
  /** False when this optional test account has no configured credentials. */
  isConfigured?: boolean;
}

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const freeUser: NexusUser = {
  get isConfigured() {
    return !!(process.env.E2E_NEXUS_FREE_USER_USERNAME && process.env.E2E_NEXUS_FREE_USER_PASSWORD);
  },
  get username() {
    return requireEnvVar("E2E_NEXUS_FREE_USER_USERNAME");
  },
  get password() {
    return requireEnvVar("E2E_NEXUS_FREE_USER_PASSWORD");
  },
};

export const premiumUser: NexusUser = {
  get isConfigured() {
    return !!(
      process.env.E2E_NEXUS_PREMIUM_USER_USERNAME && process.env.E2E_NEXUS_PREMIUM_USER_PASSWORD
    );
  },
  get username() {
    return requireEnvVar("E2E_NEXUS_PREMIUM_USER_USERNAME");
  },
  get password() {
    return requireEnvVar("E2E_NEXUS_PREMIUM_USER_PASSWORD");
  },
};
