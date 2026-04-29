export interface NexusUser {
  username: string;
  password: string;
}

function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const freeUser: NexusUser = {
  get username() {
    return requireEnvVar("E2E_NEXUS_FREE_USER_USERNAME");
  },
  get password() {
    return requireEnvVar("E2E_NEXUS_FREE_USER_PASSWORD");
  },
};
