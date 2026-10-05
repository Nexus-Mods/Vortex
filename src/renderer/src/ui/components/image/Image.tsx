import { mdiCircleOutline, mdiImageBroken, mdiLoading } from "@mdi/js";
import React, { useCallback, useState, type ImgHTMLAttributes } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface IImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "className" | "alt"
> {
  /** The picture's text alternative, which also names the fallback icon; "" if decorative. */
  alt: string;
  /** Classes for the frame, which sets the size and corners. */
  className?: string;
  /** Replaces the broken-image icon; given one, a missing `src` shows it too. */
  fallbackIconPath?: string;
  /** Fills the frame, cropping, or fits inside it whole. Default `contain`. */
  fit?: "cover" | "contain";
  /** Classes for the `img` itself. */
  imageClassName?: string;
  /** The aspect ratio the frame keeps; `other` leaves it to the container. Default `other`. */
  imageType?: "avatar" | "collection" | "game" | "mod" | "other";
  /** Blurs the picture, for adult content; it also fills the frame. */
  isBlurred?: boolean;
  /** Shows the spinner, for a picture the caller knows is coming before it has a `src`. */
  isLoading?: boolean;
}

const imageTypeMap: Record<NonNullable<IImageProps["imageType"]>, string> = {
  avatar: "nxm-image-avatar",
  collection: "nxm-image-collection",
  game: "nxm-image-game",
  mod: "nxm-image-mod",
  other: "",
};

export const Image = ({
  alt,
  children,
  className,
  fallbackIconPath,
  fit = "contain",
  imageClassName,
  imageType = "other",
  isBlurred,
  isLoading,
  onError,
  onLoad,
  src,
  ...rest
}: IImageProps) => {
  const [lastSrc, setLastSrc] = useState(src);
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (src !== lastSrc) {
    setLastSrc(src);
    setErrored(false);
    setLoaded(false);
  }

  // A cached image can finish before onLoad attaches, and `complete` is true with no src.
  const settleIfComplete = useCallback((image: HTMLImageElement | null) => {
    if (image !== null && image.complete && !!image.naturalWidth) {
      setLoaded(true);
    }
  }, []);

  // Only the caller knows a source is coming when there is no src; a failed one is settled.
  const showSpinner = !errored && (isLoading === true || (!!src && !loaded));
  const showFallback = errored || (fallbackIconPath !== undefined && !src && isLoading !== true);

  return (
    <div className={joinClasses(["nxm-image", imageTypeMap[imageType], className])}>
      {!showFallback ? (
        <img
          {...rest}
          alt={alt}
          className={joinClasses(
            [
              "nxm-image-media",
              isBlurred || fit === "cover" ? "nxm-image-media-cover" : "nxm-image-media-contain",
              imageClassName,
            ],
            {
              "nxm-image-media-blurred": isBlurred,
              "nxm-image-media-pending": !loaded,
            },
          )}
          ref={settleIfComplete}
          src={src}
          onError={(event) => {
            setErrored(true);
            onError?.(event);
          }}
          onLoad={(event) => {
            setLoaded(true);
            onLoad?.(event);
          }}
        />
      ) : (
        <Icon
          className="nxm-image-fallback"
          path={fallbackIconPath ?? mdiImageBroken}
          size="none"
          title={alt}
        />
      )}

      {showSpinner && (
        <span className="nxm-image-spinner">
          <Icon className="opacity-40" path={mdiCircleOutline} size="none" />

          <Icon className="absolute inset-0" path={mdiLoading} size="none" />
        </span>
      )}

      {children}

      <div className="nxm-image-frame" />
    </div>
  );
};
