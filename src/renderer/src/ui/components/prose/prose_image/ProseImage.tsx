import React, { type CSSProperties, useState } from "react";

import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { joinClasses } from "@/ui/utils/joinClasses";
import { webImageSrc } from "@/ui/utils/web_image_src/webImageSrc";

/** The largest width or height an image is given, as the site caps them. */
const MAX_SIZE = 3600;

/** A size given in pixels, if it is one, capped. */
const pixels = (size: number | undefined) => {
  if (!size || !Number.isFinite(size) || size <= 0) {
    return undefined;
  }

  return Math.min(Math.round(size), MAX_SIZE);
};

interface IProseImageProps {
  /** Where the image is; drawn only if `webImageSrc` keeps it. */
  src: string | undefined;
  /** Draws an https image from any site, not only Nexus Mods, for content we write or trust. */
  allowAnyDomain?: boolean;
  /** Its text alternative. */
  alt?: string;
  /** Which side it sits on, on a line of its own; otherwise it sits in the text. */
  align?: "left" | "center" | "right";
  /** Its width in pixels, rather than its own. */
  width?: number;
  /** Its height in pixels, rather than its own. */
  height?: number;
  /** Whether what it's from, such as a mod, is adult content; blurs it if the user's set to. */
  isFromAdultContent?: boolean;
}

/**
 * An image in prose, only from Nexus Mods unless any domain is allowed, as its author drew
 * it: at its own size or the one it's given, never wider than the text, and unframed. It sits on
 * the text's line, a little clear of the next, as the site's do. It's 16:9 until it loads and its
 * size is known.
 */
export const ProseImage = ({
  src,
  alt = "",
  align,
  width,
  height,
  isFromAdultContent = false,
  allowAnyDomain = false,
}: IProseImageProps) => {
  const [natural, setNatural] = useState<{ width: number; height: number }>();
  const safeSrc = webImageSrc(src, { allowAnyDomain });
  const givenWidth = pixels(width);
  const givenHeight = pixels(height);

  if (!safeSrc) {
    return null;
  }

  const naturalRatio = natural && natural.width / natural.height;
  const ratio = givenWidth && givenHeight ? givenWidth / givenHeight : naturalRatio;
  const shownWidth =
    givenWidth ?? (givenHeight && naturalRatio ? givenHeight * naturalRatio : natural?.width);

  const style = {
    "--prose-image-width": shownWidth && `${shownWidth}px`,
    "--prose-image-ratio": ratio && `${ratio}`,
  };

  return (
    <span
      className={joinClasses([], {
        "my-2 block": !!align,
        "text-left": align === "left",
        "text-center": align === "center",
        "text-right": align === "right",
      })}
      style={style as CSSProperties}
    >
      <AdultAwareImage
        alt={alt}
        className={joinClasses(["mb-1 inline-flex max-w-full align-baseline"], {
          "w-(--prose-image-width)": !!shownWidth,
          "w-full": !shownWidth,
          "aspect-(--prose-image-ratio)": !!ratio,
          "aspect-video": !ratio,
        })}
        isAdult={isFromAdultContent}
        isStyled={false}
        loading="lazy"
        referrerPolicy="no-referrer"
        src={safeSrc}
        onLoad={(event) =>
          setNatural({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })
        }
      />
    </span>
  );
};
