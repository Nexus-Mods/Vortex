import { mdiCircleOutline, mdiImageBroken, mdiLoading } from "@mdi/js";
import React, { useCallback, useState, type ImgHTMLAttributes } from "react";

import { Icon } from "@/ui/components/icon/Icon";
import { joinClasses } from "@/ui/utils/joinClasses";

export interface IImageProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  "className" | "alt"
> {
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
  imageClassName?: string;
  imageType?: "collection" | "game" | "mod" | "other";
  isBlurred?: boolean;
  isLoading?: boolean;
}

const imageTypeMap: Record<NonNullable<IImageProps["imageType"]>, string> = {
  collection: "nxm-image-collection",
  game: "nxm-image-game",
  mod: "nxm-image-mod",
  other: "",
};

export const Image = ({
  alt,
  children,
  className,
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

  return (
    <div className={joinClasses(["nxm-image", imageTypeMap[imageType], className])}>
      {!errored ? (
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
        <Icon className="nxm-image-fallback" path={mdiImageBroken} size="none" title={alt} />
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
