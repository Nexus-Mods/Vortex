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
 */
export const AdultAwareImage = ({ isAdult, ...props }: IAdultAwareImageProps) => {
  const isBlurred = useIsAdultBlurred(isAdult);

  return <Image {...props} isBlurred={isBlurred} />;
};
