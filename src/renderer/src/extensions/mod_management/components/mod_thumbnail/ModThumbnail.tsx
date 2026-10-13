import { mdiImageBroken } from "@mdi/js";
import React, { forwardRef, type HTMLAttributes } from "react";

import { Image } from "@/ui/components/image/Image";

// A mod picture on Nexus's static host, which serves a 385px-wide thumbnail beside each one.
const STATIC_PICTURE =
  /^(https:\/\/staticdelivery\.nexusmods\.com\/mods\/\d+\/images\/)(thumbnails\/)?/;

/** The Nexus thumbnail of a mod's picture, or undefined where it has none. */
export const modThumbnailUrl = (pictureUrl: string | undefined): string | undefined =>
  pictureUrl !== undefined && STATIC_PICTURE.test(pictureUrl)
    ? pictureUrl.replace(STATIC_PICTURE, "$1thumbnails/")
    : undefined;

interface IModThumbnailProps extends Omit<HTMLAttributes<HTMLSpanElement>, "className"> {
  /** The mod's full-size picture. */
  pictureUrl: string | undefined;
  /** Classes for the frame, which sets the size and corners. */
  className?: string;
}

/**
 * A mod's picture from its thumbnail, never the full size, or the fallback icon without one.
 * In a span that takes its ref and other props, so it can be a tooltip's trigger.
 */
export const ModThumbnail = forwardRef<HTMLSpanElement, IModThumbnailProps>(
  ({ pictureUrl, className, ...props }, ref) => (
    <span className="flex shrink-0" ref={ref} {...props}>
      <Image
        alt=""
        className={className}
        fallbackIconPath={mdiImageBroken}
        fit="cover"
        imageType="mod"
        src={modThumbnailUrl(pictureUrl)}
      />
    </span>
  ),
);

ModThumbnail.displayName = "ModThumbnail";
