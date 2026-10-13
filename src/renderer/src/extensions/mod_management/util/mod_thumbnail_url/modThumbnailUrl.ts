// A mod picture on Nexus's static host, which serves a 385px-wide thumbnail beside each one.
const STATIC_PICTURE =
  /^(https:\/\/staticdelivery\.nexusmods\.com\/mods\/\d+\/images\/)(thumbnails\/)?/;

/** The Nexus thumbnail of a mod's picture, or undefined where it has none. */
export const modThumbnailUrl = (pictureUrl: string | undefined): string | undefined =>
  pictureUrl !== undefined && STATIC_PICTURE.test(pictureUrl)
    ? pictureUrl.replace(STATIC_PICTURE, "$1thumbnails/")
    : undefined;
