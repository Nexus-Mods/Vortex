export const NEXUS_DOMAIN = process.env['NEXUS_DOMAIN'] || 'nexusmods.com';
export const NEXUS_API_SUBDOMAIN = process.env['API_SUBDOMAIN'] || 'api';
export const NEXUS_BASE_URL = process.env['NEXUS_BASE_URL'] || `https://www.${NEXUS_DOMAIN}.com`;
export const NEXUS_MEMBERSHIP_URL = `https://users.${NEXUS_DOMAIN}/register/memberships`;
export const FALLBACK_AVATAR = 'assets/images/noavatar.png';
// every five minutes
export const REVALIDATION_FREQUENCY = 5 * 60 * 1000;
