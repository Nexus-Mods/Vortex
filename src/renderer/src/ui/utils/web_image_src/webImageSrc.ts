/** The site images may come from, or any of its subdomains. */
const IMAGE_HOST = "nexusmods.com";

/**
 * An image's address, if it's served over https from Nexus Mods. Any other, such as a file, a
 * network path or another site, could load something local or tell a stranger who's looking.
 */
export const webImageSrc = (src: string | undefined): string | undefined => {
  if (!src || !URL.canParse(src)) {
    return undefined;
  }

  const { protocol, hostname } = new URL(src);
  const isNexus = hostname === IMAGE_HOST || hostname.endsWith(`.${IMAGE_HOST}`);

  return protocol === "https:" && isNexus ? src : undefined;
};
