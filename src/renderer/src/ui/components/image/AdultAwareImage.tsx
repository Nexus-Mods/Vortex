import React from "react";
import { useSelector } from "react-redux";

import { userInfo as selectUserInfo } from "@/extensions/nexus_integration/selectors";

import { Image, type IImageProps } from "./Image";

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
 * The base `Image` primitive stays presentational; this wrapper owns the
 * adult-content policy so it lives in exactly one place.
 */
export const AdultAwareImage = ({ isAdult, ...props }: IAdultAwareImageProps) => {
  const blurAdultContent = useSelector(selectUserInfo)?.adultBlurImages ?? true;

  return <Image {...props} isBlurred={isAdult && blurAdultContent} />;
};
