const NEXUS_DOMAIN = process.env["NEXUS_DOMAIN"] || "nexusmods.com";
const PRIVATEBIN_SUBDOMAIN =
  process.env["PRIVATEBIN_SUBDOMAIN"] || "privatebin";

export const PRIVATEBIN_HOST = `${PRIVATEBIN_SUBDOMAIN}.${NEXUS_DOMAIN}`;
