import React, { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/components/button/Button";
import { AdultAwareImage } from "@/ui/components/image/AdultAwareImage";
import { joinClasses } from "@/ui/utils/joinClasses";

/** One picture in a mod's gallery. */
export interface IGalleryImage {
  /** The full-size picture, shown large. */
  src: string;
  /** The small one, for the strip. */
  thumbnail: string;
}

interface IModGalleryProps {
  /** The pictures, the first shown large to begin with. */
  images: IGalleryImage[];
  /** Blurs every picture for a user who hasn't opted into adult content. */
  isAdult: boolean;
  /** Told the picture now shown large, whenever another is picked. */
  onPick?: (image: IGalleryImage) => void;
}

/**
 * A mod's pictures: the picked one large, over a strip of them all that scrolls sideways, with
 * arrows at its ends while there's more to see. Clicking a thumbnail, or the arrow keys on the
 * strip, picks it. With only one picture there's nothing to pick, so no strip.
 */
export const ModGallery = ({ images, isAdult, onPick }: IModGalleryProps) => {
  const { t } = useTranslation();
  const [picked, setPicked] = useState(0);
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });
  const stripRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const updateCanScroll = () => {
    const strip = stripRef.current;

    if (!strip) {
      return;
    }

    setCanScroll({
      back: strip.scrollLeft > 0,
      forward: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
    });
  };

  useEffect(() => {
    const strip = stripRef.current;

    if (!strip) {
      return undefined;
    }

    updateCanScroll();
    const observer = new ResizeObserver(updateCanScroll);
    observer.observe(strip);

    return () => observer.disconnect();
  }, [images]);

  const pick = (index: number) => {
    setPicked(index);
    onPick?.(images[index]);
    thumbnailRefs.current[index]?.focus();
    thumbnailRefs.current[index]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const pickByKey = (event: KeyboardEvent) => {
    const next = { ArrowLeft: picked - 1, ArrowRight: picked + 1, Home: 0, End: images.length - 1 }[
      event.key
    ];

    if (next === undefined || next < 0 || next >= images.length) {
      return;
    }

    event.preventDefault();
    pick(next);
  };

  const page = (direction: 1 | -1) =>
    stripRef.current?.scrollBy({
      left: direction * stripRef.current.clientWidth,
      behavior: "smooth",
    });

  const shown = images[picked] ?? images[0];

  if (!shown) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-2">
      <AdultAwareImage
        alt=""
        className="w-full rounded-sm"
        fit="cover"
        imageType="mod"
        isAdult={isAdult}
        src={shown.src}
      />

      {images.length > 1 && (
        <div className="relative flex items-center">
          <div
            aria-label={t("Images")}
            className="-m-1 flex min-w-0 flex-1 snap-x scroll-px-1 [scrollbar-width:none] gap-x-1.5 overflow-x-auto p-1"
            ref={stripRef}
            role="toolbar"
            onKeyDown={pickByKey}
            onScroll={updateCanScroll}
          >
            {images.map((image, index) => (
              <button
                aria-label={t("Image {{index}} of {{count}}", {
                  index: index + 1,
                  count: images.length,
                })}
                aria-pressed={index === picked}
                className="w-[calc((100%-4*0.375rem)/5)] shrink-0 snap-start rounded-xs"
                key={image.thumbnail}
                ref={(element) => {
                  thumbnailRefs.current[index] = element;
                }}
                tabIndex={index === picked ? 0 : -1}
                type="button"
                onClick={() => pick(index)}
              >
                <AdultAwareImage
                  alt=""
                  className={joinClasses(["w-full rounded-xs"], {
                    "[&_.nxm-image-frame]:border-neutral-strong": index === picked,
                  })}
                  fit="cover"
                  imageType="mod"
                  isAdult={isAdult}
                  src={image.thumbnail}
                />
              </button>
            ))}
          </div>

          {canScroll.back && (
            <Button
              appearance="scrim"
              brand="neutral"
              className="absolute left-1"
              leftIcon="chevron_left"
              size="sm"
              title={t("Earlier images")}
              onClick={() => page(-1)}
            />
          )}

          {canScroll.forward && (
            <Button
              appearance="scrim"
              brand="neutral"
              className="absolute right-1"
              leftIcon="chevron_right"
              size="sm"
              title={t("Later images")}
              onClick={() => page(1)}
            />
          )}
        </div>
      )}
    </div>
  );
};
