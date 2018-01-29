// note: quota settings are coordinated with the server, manipulating
//   them can cause network errors or IP bans

// quota recovers one request per second
export const QUOTA_RATE_MS: number = 1000;
// up to 300 requests
export const QUOTA_MAX: number = 300;
// twice that for premium users
export const QUOTA_MAX_PREMIUM: number = 600;

export const DEFAULT_TIMEOUT_MS: number = 5000;

export const API_URL: string = 'https://api.nexusmods.com/v1';
