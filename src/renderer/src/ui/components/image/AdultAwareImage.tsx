import React from "react";

import { Image, type IImageProps } from "./Image";
import { useIsAdultBlurred } from "./useIsAdultBlurred.hook";

export interface IAdultAwareImageProps extends IImageProps {
  /**
   * Whether the underlying content is flagged as adult. Required so it can never
   * be forgotten at a call site — rendering Nexus content imagery always forces
   * a blur decision.
   */
  isAdult: boolean;
  /**
   * The same picture blurred by the server, shown in its place when it's to be blurred, so the
   * unblurred one is never fetched and isn't blurred twice. Without one, `src` is blurred here.
   */
  blurredSrc?: string | null;
}

/**
 * An {@link Image} for Nexus content (mods, collections, gallery, ...) that
 * blurs adult content according to the logged-in user's `adultBlurImages`
 * preference. When no one is logged in (or the preference is unknown) the image
 * is blurred by default, so adult content is never shown to a user who has not
 * opted into seeing it.
 *
 * The base `Image` primitive stays presentational; the policy itself is
 * `useIsAdultBlurred`, so anything drawing Nexus imagery another way follows it too.
 *
 * Where the API sends a version it blurred itself, as v3 does, `blurredSrc` is shown instead,
 * filling the frame as a blurred picture does; where it doesn't, as the older APIs and the images
 * in descriptions don't, `src` is blurred here.
 */
export const AdultAwareImage = ({ isAdult, blurredSrc, ...props }: IAdultAwareImageProps) => {
  const isBlurred = useIsAdultBlurred(isAdult);

  if (isBlurred && blurredSrc) {
    return <Image {...props} fit="cover" src={blurredSrc} />;
  }

  return <Image {...props} isBlurred={isBlurred} />;
};
