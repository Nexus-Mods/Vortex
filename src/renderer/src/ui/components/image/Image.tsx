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
  imageClassName?: string;
  imageType?: "collection" | "mod" | "other";
  isBlurred?: boolean;
}

const imageTypeMap: Record<NonNullable<IImageProps["imageType"]>, string> = {
  collection: "aspect-collection",
  mod: "aspect-mod",
  other: "",
};

export const Image = ({
  alt,
  className,
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
          className={joinClasses(["absolute z-1 max-h-full rounded-[inherit]", imageClassName], {
            "blur-xl": isBlurred,
          })}
          src={src}
          onError={(event) => {
            setErrored(true);
            onError?.(event);
          }}
        />
      ) : (
        <Icon className="text-neutral-subdued" path={mdiImageBroken} title={alt} />
      )}

      <div className="pointer-events-none absolute inset-0 z-2 rounded-[inherit] border border-stroke-weak" />
    </div>
  );
};
