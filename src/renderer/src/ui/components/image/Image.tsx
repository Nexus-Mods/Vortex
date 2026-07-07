import { mdiImageBroken } from "@mdi/js";
import React, { useState, type ImgHTMLAttributes } from "react";

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
}

const imageTypeMap: Record<NonNullable<IImageProps["imageType"]>, string> = {
  collection: "aspect-collection",
  game: "aspect-game",
  mod: "aspect-mod",
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
  onError,
  src,
  ...rest
}: IImageProps) => {
  const [lastSrc, setLastSrc] = useState(src);
  const [errored, setErrored] = useState(false);

  if (src !== lastSrc) {
    setLastSrc(src);
    setErrored(false);
  }

  return (
    <div
      className={joinClasses([
        "group/image relative z-0 flex shrink-0 items-center justify-center overflow-hidden bg-surface-translucent-low",
        imageTypeMap[imageType],
        className,
      ])}
    >
      {!errored ? (
        <img
          {...rest}
          alt={alt}
          className={joinClasses(
            [
              "absolute z-1 rounded-[inherit]",
              fit === "cover" ? "size-full object-cover" : "max-h-full",
              imageClassName,
            ],
            {
              "blur-xl": isBlurred,
            },
          )}
          src={src}
          onError={(event) => {
            setErrored(true);
            onError?.(event);
          }}
        />
      ) : (
        <Icon className="text-neutral-subdued" path={mdiImageBroken} title={alt} />
      )}

      {children}

      <div className="pointer-events-none absolute inset-0 z-5 rounded-[inherit] border border-stroke-weak" />
    </div>
  );
};
