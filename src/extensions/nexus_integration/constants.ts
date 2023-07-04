export const NEXUS_DOMAIN = process.env['NEXUS_DOMAIN'] || 'nexusmods.com';

export const NEXUS_API_SUBDOMAIN = process.env['API_SUBDOMAIN'] || 'api';
export const NEXUS_FLAMEWORK_SUBDOMAIN = process.env['FLAMEWORK_SUBDOMAIN'] || 'www';
export const NEXUS_NEXT_SUBDOMAIN = process.env['NEXT_SUBDOMAIN'] || 'next';
export const NEXUS_USERS_SUBDOMAIN = process.env['USERS_SUBDOMAIN'] || 'users';

export const NEXUS_BASE_URL = process.env['NEXUS_BASE_URL'] || `https://${NEXUS_FLAMEWORK_SUBDOMAIN}.${NEXUS_DOMAIN}`;
export const NEXUS_NEXT_URL = process.env['NEXUS_NEXT_URL'] || `https://${NEXUS_NEXT_SUBDOMAIN}.${NEXUS_DOMAIN}`;
export const NEXUS_PROTOCOL = 'https:';
export const PREMIUM_PATH = ['account', 'billing', 'premium'];
export const FALLBACK_AVATAR = 'assets/images/noavatar.png';
// no more than once every five minutes
export const REVALIDATION_FREQUENCY = 5 * 60 * 1000;

export const OAUTH_URL = `https://${NEXUS_USERS_SUBDOMAIN}.${NEXUS_DOMAIN}/oauth`;
export const USERINFO_ENDPOINT = `https://${NEXUS_USERS_SUBDOMAIN}.${NEXUS_DOMAIN}/oauth/userinfo`;
// export const OAUTH_REDIRECT_URL = 'nxm://oauth/callback';
export const OAUTH_REDIRECT_URL = 'http://127.0.0.1:PORT';

export const OAUTH_CLIENT_ID = 'vortex_loopback';
export const NEXUS_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\n" +
"MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDhKHxCWOeUy38S3UOBOB11SNd/\n" +
"wyL9TVvzxePkEsZb4fEVGp0U5MEcDcJgXUo/fZOYTUFMX7ipvCC7sbsyKpJ0xZ/M\n" +
"l5zXMBcI03gu6p1TvG+eL0xEk6X8LD+t+GbzH9EY58bZ8kOLEx4lbAX3fNYhMhbh\n" +
"HJra9ZVW2QdgHoDV6wIDAQAB\n" +
"-----END PUBLIC KEY-----\n";
