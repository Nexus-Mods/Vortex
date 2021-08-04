export const NEXUS_DOMAIN = process.env['NEXUS_DOMAIN'] || 'nexusmods.com';
export const NEXUS_API_SUBDOMAIN = process.env['API_SUBDOMAIN'] || 'api';
export const NEXUS_MEMBERSHIP_URL =
  `https://users.${NEXUS_DOMAIN}/account/billing/premium?pk_source=vortex`;
export const FALLBACK_AVATAR = 'assets/images/noavatar.png';
// no more than once every five minutes
export const REVALIDATION_FREQUENCY = 5 * 60 * 1000;
