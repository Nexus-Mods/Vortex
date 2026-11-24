/** The site images may come from, or any of its subdomains. */
const IMAGE_HOST = "nexusmods.com";

/** A raster image held in the address itself; not SVG, which can hold more than a picture. */
const DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp|avif);base64,/i;

/**
 * An image's address, if it's served over https from Nexus Mods, or from any site with
 * `allowAnyDomain`, for content we write or trust, or is a raster image held in the address, which
 * loads nothing. Any other, such as a file, a network path or another site, could load something
 * local or tell a stranger who's looking.
 */
export const webImageSrc = (
  src: string | undefined,
  { allowAnyDomain = false }: { allowAnyDomain?: boolean } = {},
): string | undefined => {
  if (!src || !URL.canParse(src)) {
    return undefined;
  }

  if (DATA_IMAGE.test(src)) {
    return src;
  }

  const { protocol, hostname } = new URL(src);
  const isNexus = hostname === IMAGE_HOST || hostname.endsWith(`.${IMAGE_HOST}`);

  return protocol === "https:" && (allowAnyDomain || isNexus) ? src : undefined;
};
